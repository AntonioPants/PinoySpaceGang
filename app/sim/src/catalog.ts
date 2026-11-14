/**
 * Adapter from the data team's site catalog (web/public/sites.json, schema data/sites.schema.json)
 * to SiteTerrain. The catalog is the single source for site conditions: every value that
 * reaches the physics is copied with its source so the report can cite it.
 *
 * What the catalog gives the physics today:
 *   substrate           → soilType  → plume dust (environment.ts)
 *   conditions.albedo   → albedo    → glare
 *   latitude            → equinox-noon sun elevation → glare / long shadows at the poles
 *   conditions.wind_speed_10m → wind speed. The catalog has no wind *direction* (NASA POWER
 *                         scalar), so the direction is a scenario choice: opts.windTowardDeg,
 *                         default blowing east (+x, a tailwind on the default approach).
 *   conditions.rock_abundance (not in catalog 1.0; read if the data team adds it) → boulders
 */
import type { Body, SiteTerrain } from './types.ts';
import { terrainPackToSite, type TerrainPackManifest } from './loaders.ts';

export interface CatalogQuantity {
  value: number | null;
  unit?: string;
  status?: string;
  source?: { product_id?: string; url?: string } | null;
}

export interface CatalogSite {
  id: string;
  name: string;
  body: Body;
  role: 'earth_analog' | 'planetary_target';
  latitude: number;
  longitude: number;
  substrate?: string;
  morphology?: string;
  terrain: { manifest_url: string; rows: number; columns: number; spacing_m: number } | null;
  conditions: Record<string, CatalogQuantity>;
}

export interface CatalogPairing {
  earth_id: string;
  planetary_id: string;
  terrain_score: number | null;
  combined_score?: number | null;
}

export interface SiteCatalog {
  schema_version: string;
  sites: CatalogSite[];
  pairings: CatalogPairing[];
}

export interface CatalogSiteOptions {
  /** For Earth analogs: the body to simulate. Defaults to the body of the best-scoring pairing. */
  analogOf?: Exclude<Body, 'earth'>;
  /** Compass direction the wind blows towards, degrees (0 = north, 90 = east). Default 90. */
  windTowardDeg?: number;
}

/** Pairings that involve a site, best terrain score first. */
export function pairingsFor(catalog: SiteCatalog, siteId: string): CatalogPairing[] {
  return catalog.pairings
    .filter((p) => p.earth_id === siteId || p.planetary_id === siteId)
    .sort((a, b) => (b.terrain_score ?? 0) - (a.terrain_score ?? 0));
}

export function catalogSiteToSite(
  entry: CatalogSite,
  manifest: TerrainPackManifest,
  buffer: ArrayBufferLike,
  catalog?: SiteCatalog,
  opts: CatalogSiteOptions = {},
): SiteTerrain {
  let analogOf = opts.analogOf;
  if (!analogOf && entry.body === 'earth' && catalog) {
    const best = pairingsFor(catalog, entry.id)[0];
    const partner = best && catalog.sites.find((s) => s.id === best.planetary_id);
    if (partner && partner.body !== 'earth') analogOf = partner.body;
  }
  const site = terrainPackToSite(manifest, buffer, { analogOf });
  const sources: Record<string, string> = {};
  const q = (key: string) => {
    const c = entry.conditions[key];
    if (!c || typeof c.value !== 'number') return undefined;
    sources[key] = [c.source?.product_id, c.status].filter(Boolean).join(', ') || 'site catalog';
    return c.value;
  };

  const out: SiteTerrain = { ...site, id: entry.id, name: entry.name, body: entry.body };
  if (entry.substrate && entry.substrate !== 'unknown') {
    out.soilType = entry.substrate.replace(/_/g, ' ');
    sources.soilType = 'site catalog substrate label (interpreted)';
  }
  out.albedo = q('albedo');
  const speed = q('wind_speed_10m');
  if (speed !== undefined) {
    const toward = ((opts.windTowardDeg ?? 90) * Math.PI) / 180;
    out.wind = { x: speed * Math.sin(toward), y: speed * Math.cos(toward) };
    sources.wind_speed_10m += `; direction assumed (${opts.windTowardDeg ?? 90}° toward), not in catalog`;
  }
  out.rockAbundance = q('rock_abundance');
  out.sunElevationDeg = Math.max(0, 90 - Math.abs(entry.latitude));
  sources.sunElevationDeg = 'equinox noon sun elevation from catalog latitude';
  out.sources = sources;
  return out;
}
