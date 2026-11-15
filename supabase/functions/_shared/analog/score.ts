// Analog score: a port of terrain_percent() and combine() in scripts/catalog/analog_score.py
// (1.0.0), plus the ranking of one planetary feature vector against the exported Earth vectors.
import type { FeatureVector } from './describe.ts';
import { landformForFamily, type Landform } from './landform.ts';

export const ANALOG_SCORE_VERSION = '1.0.0';
export const LANDFORM_WEIGHT = 0.5;
/** Mean scaled difference at which terrain similarity falls to 1/e. */
export const DISTANCE_SCALE = 2.0;

export type Scales = Record<string, number>;
/** The shape of earth-vectors.json, written by scripts/catalog/export_click_vectors.py. */
export interface EarthVectors {
  method: { analog_score: string; descriptors: string };
  sites_json_sha256: string | null;
  scales_by_resolution_m: Record<string, Scales>;
  sites: Record<string, { morphology: string | null; inferred_landforms: string[]; vectors: Record<string, FeatureVector | null> }>;
}

/** 100 * exp(-mean(|a-b| / scale) / 2) over every frozen-scale feature; null if any is missing. */
export function terrainPercent(a: FeatureVector | null | undefined, b: FeatureVector | null | undefined, scales: Scales | undefined): number | null {
  const keys = scales ? Object.keys(scales) : [];
  if (!a || !b || !scales || !keys.length) return null;
  let sum = 0;
  for (const key of keys) {
    const x = a[key], y = b[key];
    if (x == null || y == null) return null;
    sum += Math.abs(x - y) / scales[key];
  }
  return 100 * Math.exp(-(sum / keys.length) / DISTANCE_SCALE);
}

export function combine(terrain: number | null, landformMatchPercent: number): number | null {
  return terrain === null ? null : (1 - LANDFORM_WEIGHT) * terrain + LANDFORM_WEIGHT * landformMatchPercent;
}

/** The comparison resolution for a world: the planetary pack's own spacing. Never one scale for both. */
export const RESOLUTION_M = { Moon: 150, Mars: 500 } as const;
export const resolutionKey = (resolutionM: number) => resolutionM.toFixed(1);

export interface MatchRow { earth_id: string; analog_score_percent: number; terrain_similarity_percent: number; landform: Landform }
export interface Ranking { matches: MatchRow[]; excluded_earth_sites: number }
export const round4 = (value: number) => Math.round(value * 1e4) / 1e4;

/**
 * Score one planetary vector against every Earth site, sorted by analog score, ties by id.
 * An Earth site missing any frozen feature is excluded and counted, never scored as zero.
 * `planetaryFamily` null means the landform is unmapped: every row's landform half is zero
 * and the caller must present the ranking as terrain-only.
 */
export function rank(planet: FeatureVector, resolutionM: number, earth: EarthVectors, planetaryFamily: string | null,
  planetaryFactor = 1, planetaryStatus?: string): Ranking {
  const key = resolutionKey(resolutionM), scales = earth.scales_by_resolution_m[key];
  if (!scales) throw new Error(`No frozen scales at ${key} m.`);
  if (Object.keys(scales).some(k => planet[k] == null)) throw new Error('The planetary window is missing a frozen feature.');
  const matches: MatchRow[] = []; let excluded = 0;
  for (const [id, site] of Object.entries(earth.sites)) {
    const terrain = terrainPercent(site.vectors[key], planet, scales);
    if (terrain === null) { excluded++; continue; }
    const form = landformForFamily(site.morphology, planetaryFamily, site.inferred_landforms, planetaryFactor, planetaryStatus);
    matches.push({ earth_id: id, analog_score_percent: round4(combine(terrain, form.match_percent)!), terrain_similarity_percent: round4(terrain), landform: form });
  }
  matches.sort((a, b) => b.analog_score_percent - a.analog_score_percent || (a.earth_id < b.earth_id ? -1 : a.earth_id > b.earth_id ? 1 : 0));
  return { matches, excluded_earth_sites: excluded };
}
