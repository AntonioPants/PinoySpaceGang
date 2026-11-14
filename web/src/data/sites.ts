import catalogJson from '../../public/sites.json';
import type { SiteCatalog } from '../../../app/sim/src/catalog';
import { parseCatalog } from '../lib/catalog';

export const siteCatalog = catalogJson as unknown as SiteCatalog;
export const catalogSites = siteCatalog.sites;
const parsed = parseCatalog(catalogJson);
export const targets = parsed.targets;
export const analogs = parsed.analogs;

const legacyIds: Record<string, string> = {
  shackleton_rim: 'shackleton-rim', marius_hills: 'marius-hills', jezero_crater: 'jezero', arsia_mons: 'arsia-flank',
};
export const normalizeTargetId = (id: string) => legacyIds[id] ?? id;
export const terrainScore = (targetId: string, analogId: string): number | null =>
  siteCatalog.pairings.find(p => p.planetary_id === targetId && p.earth_id === analogId)?.terrain_score ?? null;
