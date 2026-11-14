import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toPhysicsSite, mapFeatures } from '../../web/public/catalog-loader.mjs';
const publicRoot = new URL('../../web/public/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('sites.json', publicRoot), 'utf8'));
for (const site of catalog.sites.filter(s => s.terrain)) {
  const url = new URL(site.terrain.manifest_url.slice(1), publicRoot);
  const manifest = JSON.parse(await readFile(url, 'utf8'));
  const bytes = await readFile(new URL(manifest.grid.sample_file, url));
  const physics = toPhysicsSite(site, manifest, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(physics.heightmap.heights.length, site.terrain.rows * site.terrain.columns);
  assert.equal(physics.wind, undefined);
}
const manifest = {schema_version:1,grid:{rows:2,columns:3,spacing_m:10,dtype:'float32',byte_order:'little-endian'},local_frame:{vertical_offset_m:0}};
const bytes = new ArrayBuffer(24);
[11,12,13,21,22,23].forEach((v,i)=>new DataView(bytes).setFloat32(i*4,v,true));
const result=toPhysicsSite({id:'orientation-test',body:'earth'},manifest,bytes);
assert.deepEqual([...result.heightmap.heights],[21,22,23,11,12,13]);
assert.equal(mapFeatures(catalog).features.length,catalog.sites.length);
console.log('PASS: all catalog assets load; asymmetric 2x3 north/south conversion and map features');
