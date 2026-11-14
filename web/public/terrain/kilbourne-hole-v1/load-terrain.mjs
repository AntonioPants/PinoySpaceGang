/** Dependency-free loader for browsers/Node. One world unit = one metre. */
export function createTerrainData(manifest, buffer) {
  const { rows, columns, spacing_m: step } = manifest.grid;
  const base = manifest.local_frame.vertical_offset_m;
  if (manifest.schema_version !== 1 || !Number.isInteger(rows) || rows < 2 ||
      !Number.isInteger(columns) || columns < 2 || !Number.isFinite(step) || step <= 0 ||
      !Number.isFinite(base) || manifest.grid.dtype !== "float32" ||
      manifest.grid.byte_order !== "little-endian") {
    throw new Error("Unsupported terrain grid metadata");
  }
  if (buffer.byteLength !== rows * columns * 4) throw new Error("Terrain byte count mismatch");
  const view = new DataView(buffer);
  const heights = new Float32Array(rows * columns);
  const positions = new Float32Array(rows * columns * 3);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const i = row * columns + col;
      const height = view.getFloat32(i * 4, true);
      if (!Number.isFinite(height)) throw new Error(`Invalid elevation at sample ${i}`);
      heights[i] = height;
      positions.set([col * step, height - base, row * step], i * 3);
    }
  }
  const indices = new Uint32Array((rows - 1) * (columns - 1) * 6);
  let offset = 0;
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const a = row * columns + col, b = a + 1, c = a + columns;
      indices.set([a, c, b, b, c, c + 1], offset);
      offset += 6;
    }
  }
  // Piecewise-linear height on the actual mesh triangles, not bilinear sampling.
  // x/z are local metres; returned y is elevation minus the manifest's offset.
  function heightAt(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 ||
        x > (columns - 1) * step || z > (rows - 1) * step) return null;
    const col = Math.min(Math.floor(x / step), columns - 2);
    const row = Math.min(Math.floor(z / step), rows - 2);
    const fx = x / step - col, fz = z / step - row;
    const a = row * columns + col;
    const ha = positions[a * 3 + 1], hb = positions[(a + 1) * 3 + 1];
    const hc = positions[(a + columns) * 3 + 1], hd = positions[(a + columns + 1) * 3 + 1];
    return fx + fz <= 1
      ? ha + (hb - ha) * fx + (hc - ha) * fz
      : hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
  }
  return { manifest, heights, positions, indices, heightAt };
}

export async function loadTerrain(baseUrl = "/terrain/kilbourne-hole-v1/", { signal } = {}) {
  const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`, globalThis.location?.href ?? "http://localhost/");
  async function get(file) {
    const response = await fetch(new URL(file, base), { signal });
    if (!response.ok) throw new Error(`Terrain request failed: ${file} (${response.status})`);
    return response;
  }
  const manifest = await (await get("manifest.json")).json();
  const buffer = await (await get(manifest.grid.sample_file)).arrayBuffer();
  return createTerrainData(manifest, buffer);
}
