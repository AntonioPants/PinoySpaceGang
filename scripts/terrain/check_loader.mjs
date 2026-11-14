import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createTerrainData, loadTerrain } from "../../web/public/terrain/kilbourne-hole-v1/load-terrain.mjs";

const pack = new URL("../../web/public/terrain/kilbourne-hole-v1/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", pack), "utf8"));
const bytes = await readFile(new URL("elevation.f32", pack));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const terrain = createTerrainData(manifest, buffer);
assert.equal(terrain.positions.length, 161 * 161 * 3);
assert.equal(terrain.indices.length, 51200 * 3);
for (const [x, z] of [[0, 0], [4800, 0], [0, 4800], [4800, 4800], [2400, 2400]]) {
  const i = z / 30 * 161 + x / 30;
  assert.equal(terrain.heightAt(x, z), terrain.positions[i * 3 + 1]);
}
for (const [x, z] of [[-1, 0], [0, 4801], [NaN, 0], [0, Infinity]]) assert.equal(terrain.heightAt(x, z), null);
assert.throws(() => createTerrainData(manifest, new ArrayBuffer(8)), /byte count/);
const invalid = buffer.slice(0);
new DataView(invalid).setFloat32(0, NaN, true);
assert.throws(() => createTerrainData(manifest, invalid), /Invalid elevation/);

// Asymmetric saddle detects swapped axes, wrong diagonal, and bilinear-vs-triangle errors.
const saddleManifest = { schema_version: 1, grid: { rows: 2, columns: 2, spacing_m: 10, dtype: "float32", byte_order: "little-endian" }, local_frame: { vertical_offset_m: 100 } };
const saddleBytes = new ArrayBuffer(16);
[100, 110, 120, 140].forEach((v, i) => new DataView(saddleBytes).setFloat32(i * 4, v, true));
const saddle = createTerrainData(saddleManifest, saddleBytes);
assert.equal(saddle.heightAt(2, 3), 8);
assert.equal(saddle.heightAt(8, 7), 27);
assert.equal(saddle.heightAt(5, 5), 15); // Bilinear interpolation would incorrectly give 17.5.

// Exercise the actual HTTP fetch path, including a failing response.
const server = createServer(async (request, response) => {
  const file = request.url === "/manifest.json" ? "manifest.json" : request.url === "/elevation.f32" ? "elevation.f32" : null;
  if (!file) { response.writeHead(404).end(); return; }
  response.end(await readFile(new URL(file, pack)));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}/`;
  const fetched = await loadTerrain(base);
  assert.deepEqual(fetched.positions, terrain.positions);
  assert.deepEqual(fetched.indices, terrain.indices);
  await assert.rejects(loadTerrain(`${base}missing/`), /404/);
} finally {
  await new Promise(resolve => server.close(resolve));
}
console.log("PASS: HTTP loading, geometry size, sample orientation, bounds, corrupt input rejection and triangle-consistent height queries.");
