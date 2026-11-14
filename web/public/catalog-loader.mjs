/** Catalog 1.0: north-first assets -> Tim's south-first SiteTerrain interface. */
import { createTerrainData } from './terrain/kilbourne-hole-v1/load-terrain.mjs';

export function toPhysicsSite(site, manifest, buffer, catalog) {
  const data = createTerrainData(manifest, buffer);
  const { rows, columns: cols, spacing_m: cellSize } = manifest.grid;
  const heights = new Float32Array(rows * cols);
  for (let row = 0; row < rows; row++) {
    heights.set(data.heights.subarray((rows - row - 1) * cols, (rows - row) * cols), row * cols);
  }
  // POWER scalar wind speed is NOT a wind vector; no implicit environment defaults.
  return { id: site.id, name: site.name, body: site.body,
    catalog: { schema_version: catalog?.schema_version ?? '1.0.0', record: site,
      pairings: catalog?.pairings.filter(p => p.earth_id === site.id || p.planetary_id === site.id) ?? [] },
    heightmap: { rows, cols, cellSize, heights }, soilType: site.substrate };
}

export function mapFeatures(catalog) {
  return { type: 'FeatureCollection', features: catalog.sites.map(site => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [site.longitude, site.latitude] },
    properties: { id: site.id, name: site.name, body: site.body, role: site.role,
      morphology: site.morphology, terrainAvailable: site.terrain !== null }
  })) };
}

export async function loadCatalog(url = '/sites.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const catalog = await response.json();
  if (catalog.schema_version !== '1.0.0') throw new Error('Unsupported catalog version');
  return catalog;
}

export async function loadCatalogTerrain(site, base = globalThis.location?.origin, catalog) {
  if (!site.terrain) throw new Error(`${site.id}: terrain unavailable`);
  const url = new URL(site.terrain.manifest_url, base);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
  const manifest = await response.json();
  const samples = await fetch(new URL(manifest.grid.sample_file, url));
  if (!samples.ok) throw new Error(`Elevation HTTP ${samples.status}`);
  return toPhysicsSite(site, manifest, await samples.arrayBuffer(), catalog);
}
