import { syntheticTerrain } from '../src/index.ts';
export { loadTerrainPacks } from './catalog.ts';
import type { SiteTerrain } from '../src/index.ts';

const boulders = [{ center: { x: 0, y: 0 }, radiusM: 25, count: 60 }];

/** Synthetic test scenarios alongside the real catalog sites. */
export const PRESETS: Record<string, { label: string; make: () => SiteTerrain }> = {
  moon: { label: 'Moon — highlands (synthetic)', make: () => syntheticTerrain({ id: 'moon', body: 'moon', craters: 6 }) },
  moonRocks: {
    label: 'Moon — boulder field at target',
    make: () => syntheticTerrain({ id: 'moon-boulders', body: 'moon', craters: 6, boulderFields: boulders }),
  },
  mars: { label: 'Mars — plains (synthetic)', make: () => syntheticTerrain({ id: 'mars', body: 'mars', craters: 4, wind: { x: 6, y: 2 } }) },
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
