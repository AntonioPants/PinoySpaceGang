// Node 22.18+ (native TypeScript stripping); uses Tim's unchanged loader.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { terrainPackToSite } from '../../app/sim/src/loaders.ts';

if (!process.argv[2]) throw new Error('Usage: node scripts/locations/check-pack.mjs <staged terrain pack directory>');
const root = resolve(process.argv[2]);
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const bytes = await readFile(join(root, manifest.grid.sample_file));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const site = terrainPackToSite(manifest, buffer);
const raw = new DataView(buffer);
const { rows, columns } = manifest.grid;
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < columns; col++) {
    assert.equal(site.heightmap.heights[row * columns + col], raw.getFloat32(((rows - 1 - row) * columns + col) * 4, true));
  }
}
assert.equal(site.heightmap.cellSize, 30);
assert.equal(site.body, 'earth');
console.log(`PASS: ${manifest.id}; ${rows}x${columns} real samples load with the north-to-south conversion expected by physics`);
