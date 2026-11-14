/**
 * The data team's site catalog (public/sites.json) as the mission planner uses it: planetary
 * targets, Earth analogs and the proposed pairings between them. Nothing here is inferred:
 * names, descriptions, scores and limitations are copied from the catalog.
 */
import type { CatalogSite as PhysicsCatalogSite } from '../../../app/sim/src/catalog';
import type { AnalogSite, PlanetarySite } from './types';

export interface CatalogEntry extends PhysicsCatalogSite {
  region: string; description: string; evidence_url: string; study_status?: string; limitations?: string[];
}
export interface Pairing {
  earth_id: string; planetary_id: string; terrain_score: number | null; combined_score: number | null;
  reason?: string; interpretation?: string;
  geology_comparison?: { same_substrate_label: boolean; same_morphology_label: boolean };
}
export interface Catalog {
  entries: Map<string, CatalogEntry>;
  targets: PlanetarySite[];
  analogs: AnalogSite[];
  pairings: Pairing[];
}
/** Scenario gravity shown in the planner (m/s²). */
const GRAVITY = { moon: 1.62, mars: 3.72 } as const;
const label = (s?: string) => (s && s !== 'unknown' ? s.replace(/_/g, ' ') : undefined);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Candidates from the team brief with no terrain pack and no study footprint.
const candidates: AnalogSite[] = [
  { id: 'haughton', name: 'Haughton crater', region: 'Devon Island, Canada', lat: 75.38, lon: -89.68, available: false,
    description: 'A candidate from the team brief. Elevation data, comparison evidence, and a planetary pairing have not been supplied.' },
  { id: 'qaidam', name: 'Qaidam Basin', region: 'Qinghai, China', lat: 37.5, lon: 93.5, available: false,
    description: 'A candidate from the team brief. A study footprint and processed dataset are still needed.' },
];

export function parseCatalog(raw: unknown): Catalog {
  const data = raw as { schema_version?: string; sites?: CatalogEntry[]; pairings?: Pairing[] };
  if (data?.schema_version !== '1.0.0' || !Array.isArray(data.sites) || !Array.isArray(data.pairings)) throw new Error('Unsupported site catalog.');
  const entries = new Map(data.sites.map(site => [site.id, site]));
  if (entries.size !== data.sites.length) throw new Error('Duplicate catalog site IDs.');
  // Moon targets first, so the planner opens on the nearest destination.
  const targets: PlanetarySite[] = data.sites.filter(s => s.role === 'planetary_target' && s.body !== 'earth')
    .sort((a, b) => Number(a.body !== 'moon') - Number(b.body !== 'moon')).map(s => ({
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
      reliefM: typeof min === 'number' && typeof max === 'number' ? max - min : undefined,
    };
  });
  if (!targets.length || !analogs.some(a => a.available)) throw new Error('The site catalog has no usable target or analog.');
  return { entries, targets, analogs: [...analogs, ...candidates.filter(c => !entries.has(c.id))], pairings: data.pairings };
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
