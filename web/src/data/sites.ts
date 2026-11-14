import catalogJson from '../../public/sites.json';
import type { SiteCatalog } from '../../../app/sim/src/catalog';
import type { AnalogSite, PlanetarySite } from '../lib/types';

// The shared catalog owns IDs, coordinates, terrain paths and source evidence.
// JSON import inference creates incompatible optional keys for heterogeneous records.
// The committed catalog is validated by scripts/catalog/check-consumers.mjs.
export const siteCatalog = catalogJson as unknown as SiteCatalog;
export const catalogSites = siteCatalog.sites;
const names: Record<string, string> = {
  'shackleton-rim': 'Shackleton rim', 'marius-hills': 'Marius Hills', jezero: 'Jezero delta',
  'arsia-flank': 'Arsia Mons flank', phoenix: 'Phoenix plains', bagnold: 'Bagnold dunes',
  'barrow-observatory': 'Barrow Observatory', 'capitol-reef': 'Capitol Reef',
};
const legacyIds: Record<string, string> = {
  shackleton_rim: 'shackleton-rim', marius_hills: 'marius-hills', jezero_crater: 'jezero', arsia_mons: 'arsia-flank',
};
export const normalizeTargetId = (id: string) => legacyIds[id] ?? id;
const targetOrder = ['shackleton-rim', 'marius-hills', 'jezero', 'arsia-flank', 'phoenix', 'bagnold'];
export const targets: PlanetarySite[] = catalogJson.sites.filter(s => s.role === 'planetary_target').map(s => ({
  id: s.id, name: names[s.id] ?? s.name, body: s.body === 'moon' ? 'Moon' as const : 'Mars' as const,
  region: s.region, lat: s.latitude, lon: s.longitude, gravity: s.body === 'moon' ? 1.62 : 3.72,
  description: s.description, interests: [s.morphology.replaceAll('_', ' '), s.substrate.replaceAll('_', ' ')], source: s.evidence_url,
})).sort((a, b) => targetOrder.indexOf(a.id) - targetOrder.indexOf(b.id));

export const analogs: AnalogSite[] = catalogJson.sites.filter(s => s.role === 'earth_analog').map(s => ({
  id: s.id, name: names[s.id] ?? s.name, region: s.region, lat: s.latitude, lon: s.longitude,
  available: !!s.terrain, description: s.description, manifestUrl: s.terrain?.manifest_url,
  source: s.evidence_url, matches: s.matches,
})).sort((a, b) => Number(b.id === 'kilbourne-hole-v1') - Number(a.id === 'kilbourne-hole-v1'));
analogs.push(
  { id: 'haughton_crater', name: 'Haughton crater', region: 'Devon Island, Canada', lat: 75.38, lon: -89.68,
    available: false, description: 'Candidate location. A processed terrain pack and study footprint are still needed.', matches: [] },
  { id: 'qaidam_basin', name: 'Qaidam Basin', region: 'Qinghai, China', lat: 37.5, lon: 93.5,
    available: false, description: 'Candidate location. A processed terrain pack and study footprint are still needed.', matches: [] },
);
