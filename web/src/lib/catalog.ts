/**
 * The data team's site catalog (public/sites.json) as the mission planner uses it: planetary
 * targets, Earth analogs and the proposed pairings between them. Nothing here is inferred:
 * names, descriptions, scores and limitations are copied from the catalog.
 */
import type { CatalogSite as PhysicsCatalogSite, SiteCatalog } from '../../../app/sim/src/catalog';
import type { AnalogSite, PlanetarySite } from './types';
import type { AnalogMatching } from './matching';

export interface CatalogEntry extends PhysicsCatalogSite {
  region: string; description: string; evidence_url: string; study_status?: string; limitations?: string[];
}
export interface Pairing {
  earth_id: string; planetary_id: string; terrain_score: number | null; combined_score: number | null;
  reason?: string; interpretation?: string;
  explanation?: { status: 'proposed_unvalidated'; matches: string[]; differences: string[]; sources: string[]; scope: string };
  geology_comparison?: { same_substrate_label: boolean; same_morphology_label: boolean };
}
export interface Catalog {
  source: SiteCatalog;
  entries: Map<string, CatalogEntry>;
  targets: PlanetarySite[];
  analogs: AnalogSite[];
  pairings: Pairing[];
  matching?: AnalogMatching;
}
/** Scenario gravity shown in the planner (m/s²). */
const GRAVITY = { moon: 1.62, mars: 3.72 } as const;
const TARGET_ORDER = ['shackleton-rim', 'marius-hills', 'malapert-massif', 'mons-mouton', 'jezero', 'arsia-flank', 'phoenix', 'bagnold'];
const targetRank = (id: string) => {
  const index = TARGET_ORDER.indexOf(id);
  return index < 0 ? TARGET_ORDER.length : index;
};
const label = (s?: string) => (s && s !== 'unknown' ? s.replace(/_/g, ' ') : undefined);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Candidates from the team brief with no terrain pack and no study footprint.
const candidates: AnalogSite[] = [
  { id: 'haughton', name: 'Haughton crater', region: 'Devon Island, Canada', lat: 75.38, lon: -89.68, available: false,
    description: 'Site missing from the deployed catalog.', matches: [] },
  { id: 'qaidam', name: 'Qaidam Basin', region: 'Qinghai, China', lat: 37.5, lon: 93.5, available: false,
    description: 'Site missing from the deployed catalog.', matches: [] },
];

export function parseCatalog(raw: unknown): Catalog {
  const data = raw as { schema_version?: string; sites?: CatalogEntry[]; pairings?: Pairing[]; analog_matching?: AnalogMatching };
  if (data?.schema_version !== '1.0.0' || !Array.isArray(data.sites) || !Array.isArray(data.pairings)) throw new Error('Unsupported site catalog.');
  const entries = new Map(data.sites.map(site => [site.id, site]));
  if (entries.size !== data.sites.length) throw new Error('Duplicate catalog site IDs.');
  // Moon targets first, so the planner opens on the nearest destination.
  const targets: PlanetarySite[] = data.sites.filter(s => s.role === 'planetary_target' && s.body !== 'earth')
    .sort((a, b) => targetRank(a.id) - targetRank(b.id)).map(s => ({
    id: s.id, name: s.name, body: s.body === 'moon' ? 'Moon' : 'Mars', region: s.region, lat: s.latitude, lon: s.longitude,
    gravity: GRAVITY[s.body as 'moon' | 'mars'], description: s.description,
    interests: [label(s.morphology), label(s.substrate)].filter((v): v is string => !!v).map(cap), source: s.evidence_url,
  }));
  const analogs: AnalogSite[] = data.sites.filter(s => s.role === 'earth_analog').map(s => {
    const min = s.conditions.elevation_min?.value, max = s.conditions.elevation_max?.value;
    return {
      id: s.id, name: s.name, region: s.region, lat: s.latitude, lon: s.longitude, available: s.terrain !== null,
      description: s.description, morphology: label(s.morphology), substrate: label(s.substrate), evidenceUrl: s.evidence_url,
      terrainBase: s.terrain ? s.terrain.manifest_url.replace(/[^/]*$/, '') : undefined,
      manifestUrl: s.terrain?.manifest_url,
      matches: data.pairings!.filter(p => p.earth_id === s.id).map(p => p.planetary_id),
      reliefM: typeof min === 'number' && typeof max === 'number' ? max - min : undefined,
    };
  });
  if (!targets.length || !analogs.some(a => a.available)) throw new Error('The site catalog has no usable target or analog.');
  return { source: raw as SiteCatalog, entries, targets, analogs: [...analogs, ...candidates.filter(c => !entries.has(c.id))], pairings: data.pairings, matching: data.analog_matching };
}

export async function loadCatalog(signal?: AbortSignal): Promise<Catalog> {
  const response = await fetch('/sites.json', { signal });
  if (!response.ok) throw new Error(`Site catalog unavailable (${response.status}).`);
  return parseCatalog(await response.json());
}

export const pairingOf = (catalog: Catalog, targetId: string, analogId: string) =>
  catalog.pairings.find(p => p.planetary_id === targetId && p.earth_id === analogId);

/** Analogs for a target: proposed pairings first (best terrain score first), then the rest. */
export function analogsFor(catalog: Catalog, targetId: string): AnalogSite[] {
  const score = (a: AnalogSite) => pairingOf(catalog, targetId, a.id)?.terrain_score ?? -1;
  const paired = catalog.analogs.filter(a => pairingOf(catalog, targetId, a.id)).sort((a, b) => score(b) - score(a));
  const rest = catalog.analogs.filter(a => !pairingOf(catalog, targetId, a.id));
  return [...paired, ...rest.filter(a => a.available), ...rest.filter(a => !a.available)];
}

/** Up to ten available candidates after the pipeline's conservative screening. */
export function recommendedAnalogs(catalog: Catalog, targetId: string): AnalogSite[] {
  if (!catalog.matching) return analogsFor(catalog,targetId).filter(s => s.available).slice(0,10);
  const reviewed = catalog.matching?.comparisons
    .filter(p => p.planetary_id === targetId && p.verification.catalog_features_reproduced
      && p.verification.input_hashes_checked && p.terrain_similarity_percent !== null)
    .sort((a,b) => a.candidate_rank-b.candidate_rank || a.earth_id.localeCompare(b.earth_id));
  const candidates: AnalogSite[] = [];
  for (const match of reviewed) {
    const site = catalog.analogs.find(s => s.id === match.earth_id && s.available);
    if (site && !candidates.some(s => s.id === site.id)) candidates.push(site);
    if (candidates.length === 10) break;
  }
  return candidates;
}

/** Default selection; callers can offer the remaining recommendedAnalogs. */
export function recommendedAnalog(catalog: Catalog, targetId: string): AnalogSite | undefined {
  return recommendedAnalogs(catalog,targetId)[0];
}
