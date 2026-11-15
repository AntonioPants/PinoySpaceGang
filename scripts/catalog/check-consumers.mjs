import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { toPhysicsSite, mapFeatures } from '../../web/public/catalog-loader.mjs';
const publicRoot = new URL('../../web/public/', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('sites.json', publicRoot), 'utf8'));
const validity = JSON.parse(await readFile(new URL('comparison-validity.json', publicRoot), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(validity.catalog_sha256, sha(await readFile(new URL('sites.json', publicRoot))), 'Regenerate comparison validity after catalog changes');
assert.equal(validity.scales_sha256, sha(await readFile(new URL('../../data/terrain-scales.json', import.meta.url))), 'Validity scales are stale');
assert.equal(validity.references_sha256, sha(await readFile(new URL('../../data/validation-references.json', import.meta.url))), 'Validation references are stale');
assert.equal(validity.protocol_sha256, sha(await readFile(new URL('../../data/validation-protocol.json', import.meta.url))), 'Validation protocol is stale');
assert.equal(validity.generator_sha256, sha(await readFile(new URL('validity.py', import.meta.url))), 'Validity generator changed');
const stereo = JSON.parse(await readFile(new URL('terrain-pilot-comparison.json', publicRoot), 'utf8'));
assert.equal(stereo.catalog_sha256, validity.catalog_sha256, 'Stereo comparison catalog is stale');
assert.equal(stereo.scales_sha256, validity.scales_sha256, 'Stereo comparison scales are stale');
assert.equal(stereo.config_sha256, sha(await readFile(new URL('../../data/terrain-upgrade-pilots.json', import.meta.url))), 'Stereo configuration is stale');
assert.equal(stereo.generator_sha256, sha(await readFile(new URL('pilot_comparison.py', import.meta.url))), 'Stereo generator changed');
for (const [id, pilot] of Object.entries(stereo.pilots)) {
  const site = catalog.sites.find(s => s.id === id);
  assert.equal(pilot.catalog_elevation_sha256, site.terrain.elevation_sha256);
  const manifestUrl = new URL(pilot.manifest_url.slice(1), publicRoot);
  assert.equal(pilot.manifest_sha256, sha(await readFile(manifestUrl)), 'Stereo manifest changed');
  assert.equal(pilot.pilot_elevation_sha256, sha(await readFile(new URL('elevation.f32', manifestUrl))), 'Stereo elevations changed');
  assert.equal(pilot.generator_sha256, sha(await readFile(new URL('ingest_pilot.py', import.meta.url))), 'Pilot ingestion changed');
}
const external = JSON.parse(await readFile(new URL('external-validation.json', publicRoot), 'utf8'));
assert.equal(external.catalog_sha256, validity.catalog_sha256);
assert.equal(external.references_sha256, validity.references_sha256);
assert.equal(external.protocol_sha256, validity.protocol_sha256);
assert.equal(external.reserved_catalog_sha256, sha(await readFile(new URL('validation-terrain/sites.json', publicRoot))));
assert.equal(external.generator_sha256, sha(await readFile(new URL('external_validation.py', import.meta.url))));
assert.equal(external.reserved_config_sha256, sha(await readFile(new URL('../../data/validation-sites.json', import.meta.url))));
const reserved = JSON.parse(await readFile(new URL('validation-terrain/sites.json', publicRoot)));
for (const site of reserved.sites) {
  const manifestUrl = new URL(`validation-terrain${site.terrain.manifest_url}`, publicRoot);
  assert.equal(site.terrain.manifest_sha256, sha(await readFile(manifestUrl)));
  assert.equal(site.terrain.elevation_sha256, sha(await readFile(new URL('elevation.f32', manifestUrl))));
}
for (const [path, hash] of Object.entries(external.method_sha256)) {
  assert.equal(hash, sha(await readFile(new URL(`../../${path}`, import.meta.url))), 'Frozen evaluation method changed');
}
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
