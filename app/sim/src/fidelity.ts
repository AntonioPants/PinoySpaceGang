/**
 * Analog Fidelity Score: how well does a landing on the Earth analog predict the landing on
 * the planetary site?
 *
 * Method: fly the *same* lander, strategy and sensors on both terrains under the planetary
 * body's gravity and atmosphere, over several seeds, and compare what happened:
 *
 *   outcome   (40 %)  share of seeds that end in the same outcome class
 *   touchdown (25 %)  agreement of sink rate and lateral speed, relative to the lander's limits
 *   ground    (20 %)  agreement of slope and rock/roughness under the legs, relative to limits
 *   fuel      (15 %)  agreement of fuel used
 *
 * 100 = the analog flight was a perfect rehearsal; 0 = it told you nothing. This is a
 * *flight-dynamics* comparison of two terrain grids. It says nothing about geology or soil
 * mechanics, and it inherits the resolution of the terrain data (see the catalog's limitations).
 * The catalog's static terrain similarity score is reported alongside, not folded in.
 */
import type { FlightSummary, Outcome, SimInput, SiteTerrain } from './types.ts';
import { runSim, resolveLander } from './engine.ts';

export interface FidelityOptions {
  /**
   * Shared flight setup (strategy, lander, sensors, interference...). `gravity` and `atmosphere`
   * default to the planetary body's; set them to use the exact scenario values of a flown mission.
   */
  base?: Partial<Omit<SimInput, 'site'>>;
  /** Seeds to fly on each site. Default [1, 2, 3]. */
  seeds?: number[];
  /** Static terrain similarity from the catalog pairing (0..1), passed through for the report. */
  catalogTerrainScore?: number | null;
}

export interface SiteFlightStats {
  siteId: string;
  outcomes: Outcome[];
  successRate: number;
  meanSinkMps: number;
  meanLateralMps: number;
  meanSlopeDeg: number;
  meanRoughnessM: number;
  meanFuelUsedKg: number;
}

export interface FidelityResult {
  /** 0..100 */
  score: number;
  components: { outcome: number; touchdown: number; ground: number; fuel: number };
  planetary: SiteFlightStats;
  analog: SiteFlightStats;
  catalogTerrainScore: number | null;
  gravity: number;
  airDensity: number;
  seeds: number[];
  method: string;
}

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
/** 1 when equal, falling linearly to 0 when the difference reaches `scale`. */
const agree = (a: number, b: number, scale: number) => Math.max(0, 1 - Math.abs(a - b) / scale);

function stats(siteId: string, runs: FlightSummary[]): SiteFlightStats {
  return {
    siteId,
    outcomes: runs.map((r) => r.outcome),
    successRate: runs.filter((r) => r.outcome === 'success').length / runs.length,
    meanSinkMps: mean(runs.map((r) => r.verticalSpeedMps)),
    meanLateralMps: mean(runs.map((r) => r.horizontalSpeedMps)),
    meanSlopeDeg: mean(runs.map((r) => r.slopeDeg)),
    meanRoughnessM: mean(runs.map((r) => r.roughnessM)),
    meanFuelUsedKg: mean(runs.map((r) => r.fuelUsedKg)),
  };
}

export function analogFidelity(planetary: SiteTerrain, analog: SiteTerrain, opts: FidelityOptions = {}): FidelityResult {
  if (planetary.body === 'earth') throw new Error('analogFidelity: first site must be the Moon/Mars site');
  const seeds = opts.seeds ?? [1, 2, 3];
  const base: Omit<SimInput, 'site'> = { strategy: 'autonomous', ...opts.base };
  // the analog is flown as a stand-in for the planetary body
  const analogSite: SiteTerrain = { ...analog, analogOf: planetary.body };

  const fly = (site: SiteTerrain) =>
    seeds.map((seed) => runSim({ ...base, site, seed, gravity: base.gravity ?? 'target', atmosphere: base.atmosphere ?? 'target' }));
  const pTel = fly(planetary);
  const aTel = fly(analogSite);
  const p = pTel.map((t) => t.summary!);
  const a = aTel.map((t) => t.summary!);
  const lim = resolveLander({ ...base, site: planetary }).limits;
  const fuelLoad = resolveLander({ ...base, site: planetary }).fuelKg;

  const P = stats(planetary.id, p);
  const A = stats(analog.id, a);
  const outcome = seeds.filter((_, i) => p[i].outcome === a[i].outcome).length / seeds.length;
  const touchdown =
    0.5 * agree(P.meanSinkMps, A.meanSinkMps, 2 * lim.maxVerticalMps) +
    0.5 * agree(P.meanLateralMps, A.meanLateralMps, 2 * lim.maxHorizontalMps);
  const ground =
    0.5 * agree(P.meanSlopeDeg, A.meanSlopeDeg, lim.maxSlopeDeg) +
    0.5 * agree(P.meanRoughnessM, A.meanRoughnessM, lim.maxRoughnessM);
  const fuel = agree(P.meanFuelUsedKg, A.meanFuelUsedKg, 0.5 * fuelLoad);

  return {
    score: Math.round(100 * (0.4 * outcome + 0.25 * touchdown + 0.2 * ground + 0.15 * fuel)),
    components: { outcome, touchdown, ground, fuel },
    planetary: P,
    analog: A,
    catalogTerrainScore: opts.catalogTerrainScore ?? null,
    gravity: pTel[0].environment.gravity,
    airDensity: pTel[0].environment.airDensity,
    seeds,
    method:
      'Same lander flown on both terrains under the planetary gravity and atmosphere; ' +
      'score = 40% outcome agreement + 25% touchdown speeds + 20% ground slope/roughness + 15% fuel used.',
  };
}
