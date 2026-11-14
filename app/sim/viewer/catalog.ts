import { terrainPackToSite } from '../src/loaders.ts';
import type { Body, SiteTerrain } from '../src/types.ts';

interface CatalogSite {
  id: string;
  name: string;
  body: Body;
  substrate?: string;
  terrain: { manifest_url: string } | null;
}
interface Catalog {
  schema_version: string;
  sites: CatalogSite[];
  pairings: { earth_id: string; planetary_id: string }[];
}
export interface UnavailableSite { id: string; name: string; reason: string }
export interface CatalogResult { sites: SiteTerrain[]; unavailable: UnavailableSite[] }

// Deferred candidates have no production terrain or invented study footprint.
const candidates: UnavailableSite[] = [
  { id: 'haughton', name: 'Haughton Crater', reason: 'Candidate only; no production terrain pack' },
  { id: 'qaidam', name: 'Qaidam Basin', reason: 'Candidate only; no production terrain pack' },
];

/** Native sites plus explicitly labelled Earth/target scenarios. No scientific defaults inferred. */
export async function loadTerrainPacks(
  catalogUrl = '/sites.json',
  fetcher: typeof fetch = fetch,
): Promise<SiteTerrain[]> {
  return (await loadViewerCatalog(catalogUrl, fetcher)).sites;
}

export async function loadViewerCatalog(
  catalogUrl = '/sites.json',
  fetcher: typeof fetch = fetch,
): Promise<CatalogResult> {
  const base = new URL(catalogUrl, globalThis.location?.href ?? 'http://localhost/');
  async function get(url: URL) {
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`${url.pathname}: HTTP ${response.status}`);
    return response;
  }
  const catalog: Catalog = await (await get(base)).json();
  if (catalog.schema_version !== '1.0.0' || !Array.isArray(catalog.sites) || !Array.isArray(catalog.pairings)) {
    throw new Error('Unsupported site catalog');
  }
  const byId = new Map(catalog.sites.map(site => [site.id, site]));
  if (byId.size !== catalog.sites.length) throw new Error('Duplicate catalog site IDs');
  const results = await Promise.all(catalog.sites.map(async site => {
    try {
      if (!site.terrain) throw new Error('No production terrain pack');
      const manifestUrl = new URL(site.terrain!.manifest_url, base);
      const manifest = await (await get(manifestUrl)).json();
      if (manifest.id !== site.id || manifest.body.toLowerCase() !== site.body) {
        throw new Error(`${site.id}: manifest does not match catalog`);
      }
      const buffer = await (await get(new URL(manifest.grid.sample_file, manifestUrl))).arrayBuffer();
      const native = { ...terrainPackToSite(manifest, buffer), name: `${site.name} (${site.body}, native)`, soilType: site.substrate };
      const scenarios: SiteTerrain[] = [native];
      if (site.body === 'earth') {
        for (const pair of catalog.pairings.filter(pair => pair.earth_id === site.id)) {
          const target = byId.get(pair.planetary_id);
          if (!target || !['moon', 'mars'].includes(target.body)) throw new Error(`Invalid pairing target: ${pair.planetary_id}`);
          scenarios.push({ ...native, id: `${site.id}--${target.id}`, analogOf: target.body as 'moon' | 'mars',
            name: `${site.name} → ${target.name} (${target.body}, proposed analog)` });
        }
      }
      return { sites: scenarios, unavailable: [] } satisfies CatalogResult;
    } catch (error) {
      return { sites: [], unavailable: [{ id: site.id, name: site.name,
        reason: error instanceof Error ? error.message : String(error) }] } satisfies CatalogResult;
    }
  }));
  return { sites: results.flatMap(result => result.sites),
    unavailable: [...results.flatMap(result => result.unavailable), ...candidates.filter(site => !byId.has(site.id))] };
}
