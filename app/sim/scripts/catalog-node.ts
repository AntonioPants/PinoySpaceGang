/** Node-side loading of the site catalog and its terrain packs (for scripts and tests). */
import { readFileSync } from 'node:fs';
import { catalogSiteToSite } from '../src/index.ts';
import type { SiteCatalog, SiteTerrain, CatalogSiteOptions } from '../src/index.ts';

const PUBLIC = new URL('../../../web/public/', import.meta.url);

export function readCatalog(): SiteCatalog {
  return JSON.parse(readFileSync(new URL('sites.json', PUBLIC), 'utf8'));
}

export function loadCatalogSite(catalog: SiteCatalog, id: string, opts?: CatalogSiteOptions): SiteTerrain {
  const entry = catalog.sites.find((s) => s.id === id);
  if (!entry) throw new Error(`site ${id} is not in the catalog`);
  if (!entry.terrain) throw new Error(`site ${id} has no terrain`);
  const manifestUrl = new URL(entry.terrain.manifest_url.replace(/^\//, ''), PUBLIC);
  const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));
  const buf = readFileSync(new URL(manifest.grid.sample_file, manifestUrl));
  return catalogSiteToSite(entry, manifest, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), catalog, opts);
}
