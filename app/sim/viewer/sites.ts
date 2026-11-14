import { catalogSiteToSite, syntheticTerrain } from '../src/index.ts';
import type { SiteCatalog } from '../src/index.ts';
import catalogUrl from '../../../web/public/sites.json?url';
import type { SiteTerrain } from '../src/index.ts';

const boulders = [{ center: { x: 0, y: 0 }, radiusM: 25, count: 60 }];

/** Synthetic test sites until the real sites.json lands. */
export const PRESETS: Record<string, { label: string; make: () => SiteTerrain }> = {
  moon: { label: 'Moon — highlands (synthetic)', make: () => ({ ...syntheticTerrain({ id: 'moon', body: 'moon', craters: 6 }), soilType: 'regolith', rockAbundance: 0.02 }) },
  moonRocks: {
    label: 'Moon — boulder field at target',
    make: () => syntheticTerrain({ id: 'moon-boulders', body: 'moon', craters: 6, boulderFields: boulders }),
  },
  mars: { label: 'Mars — plains (synthetic)', make: () => ({ ...syntheticTerrain({ id: 'mars', body: 'mars', craters: 4, wind: { x: 6, y: 2 } }), soilType: 'dust', rockAbundance: 0.05, windGustMps: 2 }) },
  marsRocks: {
    label: 'Mars — boulder field at target',
    make: () => syntheticTerrain({ id: 'mars-boulders', body: 'mars', craters: 4, wind: { x: 6, y: 2 }, boulderFields: boulders }),
  },
  slope: {
    label: 'Moon — 14° slope (tip-over test)',
    make: () => syntheticTerrain({ id: 'moon-slope', body: 'moon', hillsM: 1, baseSlopeDeg: 14 }),
  },
  earth: {
    label: 'Earth analog for Mars (synthetic)',
    make: () => syntheticTerrain({ id: 'earth-analog', body: 'earth', analogOf: 'mars', wind: { x: 8, y: 0 }, boulderFields: boulders }),
  },
};

const cache = new Map<string, SiteTerrain>();

/** Keys are `preset:<name>` or `file:<site id>`. */
export function resolveSite(key: string, fileSites: Map<string, SiteTerrain>): SiteTerrain {
  if (key.startsWith('file:')) {
    const s = fileSites.get(key.slice(5));
    if (!s) throw new Error(`unknown site ${key}`);
    return s;
  }
  if (!cache.has(key)) cache.set(key, PRESETS[key.slice(7)].make());
  return cache.get(key)!;
}

// Vite resolves every terrain pack under web/public/terrain at build time.
const manifests = import.meta.glob('../../../web/public/terrain/*/manifest.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const grids = import.meta.glob('../../../web/public/terrain/*/elevation.f32', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const packUrl = (table: Record<string, string>, id: string, file: string) =>
  table[`../../../web/public/terrain/${id}/${file}`];

export interface LoadedCatalog {
  catalog: SiteCatalog;
  sites: SiteTerrain[];
}

/**
 * Every site in the data team's catalog (web/public/sites.json) that has a terrain pack, with
 * its conditions applied. Earth analogs fly as the body of their best-scoring pairing.
 */
export async function loadCatalogSites(): Promise<LoadedCatalog> {
  const catalog: SiteCatalog = await fetch(catalogUrl).then((r) => r.json());
  const sites = await Promise.all(
    catalog.sites
      .filter((entry) => entry.terrain && packUrl(manifests, entry.id, 'manifest.json') && packUrl(grids, entry.id, 'elevation.f32'))
      .map(async (entry) => {
        const [manifest, buffer] = await Promise.all([
          fetch(packUrl(manifests, entry.id, 'manifest.json')).then((r) => r.json()),
          fetch(packUrl(grids, entry.id, 'elevation.f32')).then((r) => r.arrayBuffer()),
        ]);
        const site = catalogSiteToSite(entry, manifest, buffer, catalog);
        const tag = site.body === 'earth' ? `Earth analog${site.analogOf ? ` for ${site.analogOf}` : ''}` : site.body;
        return { ...site, name: `${entry.name} (${tag})` };
      }),
  );
  return { catalog, sites };
}
