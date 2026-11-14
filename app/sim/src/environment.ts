/**
 * Turns a site's measured surface properties into sensor-interference levels, so the dust and
 * glare a lander faces come from data instead of a slider:
 *
 *  - dust:  how easily the plume lifts the surface. Fine regolith / dust (Moon, Mars, dry silt)
 *           lofts readily; rock, wet clay and lava hardly at all; loose snow blows like dust.
 *  - glare: bright, low-sun surfaces blind cameras. Driven by snow cover (e.g. JAXA/MODIS snow
 *           products), albedo (MODIS / NASA POWER / Diviner / TES) and sun elevation
 *           (LOLA illumination maps for the lunar poles).
 *  - darkness (folded into glare for camera hazard sensors): long polar shadows
 *           (shadowFraction) leave a camera nearly blind; lidar doesn't care.
 */
import type { Interference, SiteTerrain } from './types.ts';

const SOIL_DUST: Array<[RegExp, number]> = [
  [/snow/i, 0.6],
  [/regolith|dust|loess|silt/i, 0.7],
  [/sand/i, 0.5],
  [/ash|tephra|scoria|cinder/i, 0.45],
  [/loam/i, 0.35],
  [/clay/i, 0.2],
  [/breccia|gravel|pebble/i, 0.25],
  [/basalt|lava|rock|bedrock/i, 0.1],
  [/ice/i, 0.15],
];

export function dustFromSoil(site: SiteTerrain): number {
  const soil = site.soilType ?? '';
  for (const [re, v] of SOIL_DUST) if (re.test(soil)) return v;
  // no soil data: airless/dusty bodies default to fine regolith
  if (site.body === 'moon') return 0.7;
  if (site.body === 'mars') return 0.55;
  return 0.3;
}

export function glareFromSite(site: SiteTerrain): number {
  const snow = clamp01(site.snowCover ?? 0);
  const albedo = site.albedo ?? (snow > 0 ? 0.6 : 0.15);
  const sunElev = site.sunElevationDeg ?? 45;
  // brightness above typical bare ground, amplified by a low sun (long specular paths)
  const bright = clamp01((albedo - 0.2) / 0.6) * 0.6 + snow * 0.4;
  const lowSun = sunElev < 15 ? 1 + (15 - sunElev) / 15 : 1;
  const shadow = clamp01(site.shadowFraction ?? 0) * 0.7; // dark polar terrain also blinds cameras
  return clamp01(bright * lowSun + shadow);
}

/** Site-derived interference; anything set explicitly in `override` wins. */
export function siteInterference(site: SiteTerrain, override: Partial<Interference> = {}): Interference {
  return {
    dust: override.dust ?? dustFromSoil(site),
    glare: override.glare ?? glareFromSite(site),
  };
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** One entry of data/site-environment.json (see scripts/fetch-environment.ts). */
export interface SiteEnvironment {
  wind?: { x: number; y: number } | null;
  windGustMps?: number | null;
  albedo?: number | null;
  soilType?: string | null;
  snowCover?: number | null;
  sunElevationDeg?: number | null;
  shadowFraction?: number | null;
  rockAbundance?: number | null;
  sources?: Record<string, string>;
}

/** Merges measured environment values into a site; null/missing values keep what the site had. */
export function applyEnvironment(site: SiteTerrain, env: SiteEnvironment | undefined): SiteTerrain {
  if (!env) return site;
  const pick = <K extends keyof SiteEnvironment>(k: K) => (env[k] ?? undefined) as NonNullable<SiteEnvironment[K]> | undefined;
  return {
    ...site,
    wind: pick('wind') ?? site.wind,
    windGustMps: pick('windGustMps') ?? site.windGustMps,
    albedo: pick('albedo') ?? site.albedo,
    soilType: pick('soilType') ?? site.soilType,
    snowCover: pick('snowCover') ?? site.snowCover,
    sunElevationDeg: pick('sunElevationDeg') ?? site.sunElevationDeg,
    shadowFraction: pick('shadowFraction') ?? site.shadowFraction,
    rockAbundance: pick('rockAbundance') ?? site.rockAbundance,
    sources: { ...site.sources, ...env.sources },
  };
}
