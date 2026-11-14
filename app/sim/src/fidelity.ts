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

// ---------------------------------------------------------------------------------------------
// Stress test
// ---------------------------------------------------------------------------------------------

export interface StressOptions {
  /** Shared flight setup, as for analogFidelity. Any hazard sensor is switched off for the test. */
  base?: Partial<Omit<SimInput, 'site' | 'target' | 'start'>>;
  /** Landing targets per side of the grid laid over each terrain (n × n flights per site). Default 5. */
  gridSize?: number;
  /**
   * Optional ASSUMED rock abundance applied to BOTH sites (no site has measured values yet).
   * Default 0: the test then uses terrain data only and assumes nothing.
   */
  assumedRockAbundance?: number;
  catalogTerrainScore?: number | null;
}

export interface StressSiteStats {
  siteId: string;
  flights: number;
  /** Share of blind landings that ended in success: how much of the terrain is landable. */
  successRate: number;
  meanSlopeDeg: number;
  meanFuelUsedKg: number;
  outcomes: Record<string, number>;
}

export interface StressFidelityResult {
  /** 0..100 */
  score: number;
  components: { successRate: number; ground: number; fuel: number };
  planetary: StressSiteStats;
  analog: StressSiteStats;
  gridSize: number;
  assumedRockAbundance: number;
  catalogTerrainScore: number | null;
  gravity: number;
  airDensity: number;
  method: string;
}

/**
 * Analog fidelity under stress. A single guided landing at the centre of each terrain succeeds
 * almost everywhere, because hazard avoidance finds a safe spot, so it cannot tell analogs
 * apart. The stress test removes that help: it lands BLIND (no hazard sensor, no divert) at a
 * grid of targets spread over the middle of each terrain and compares how much of each one is
 * actually landable.
 *
 *   landable share (50 %)  how close the two sites' blind-landing success rates are
 *   ground         (30 %)  mean slope under the legs at touchdown, relative to the limit
 *   fuel           (20 %)  mean fuel used
 *
 * Caveat that belongs next to every score: the planetary grids (150–500 m per sample) are much
 * coarser than the Earth grids (30 m), so planetary terrain looks smoother than it is and a
 * rugged Earth site scores lower partly for that reason.
 */
export function stressFidelity(planetary: SiteTerrain, analog: SiteTerrain, opts: StressOptions = {}): StressFidelityResult {
  if (planetary.body === 'earth') throw new Error('stressFidelity: first site must be the Moon/Mars site');
  const n = opts.gridSize ?? 5;
  const k = opts.assumedRockAbundance ?? 0;
  const base: Omit<SimInput, 'site'> = {
    ...opts.base,
    strategy: 'autonomous',
    sensors: { ...opts.base?.sensors, hazard: 'none' },
  };
  const analogSite: SiteTerrain = { ...analog, analogOf: planetary.body };
  const lander = resolveLander({ ...base, site: planetary });
  let gravity = 0;
  let airDensity = 0;

  const fly = (site: SiteTerrain, id: string): StressSiteStats => {
    const { cols, rows, cellSize } = site.heightmap;
    // targets over the central 50 % of the patch, so the 400 m approach stays on the grid
    const halfX = ((cols - 1) * cellSize) / 4;
    const halfY = ((rows - 1) * cellSize) / 4;
    const runs: FlightSummary[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const target = { x: -halfX + (2 * halfX * (i + 0.5)) / n, y: -halfY + (2 * halfY * (j + 0.5)) / n };
        const tel = runSim({
          ...base,
          site,
          target,
          rockAbundance: k > 0 ? k : undefined,
          seed: 1 + i * n + j,
          gravity: base.gravity ?? 'target',
          atmosphere: base.atmosphere ?? 'target',
        });
        gravity = tel.environment.gravity;
        airDensity = tel.environment.airDensity;
        runs.push(tel.summary!);
      }
    }
    const outcomes: Record<string, number> = {};
    for (const r of runs) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
    return {
      siteId: id,
      flights: runs.length,
      successRate: runs.filter((r) => r.outcome === 'success').length / runs.length,
      meanSlopeDeg: mean(runs.map((r) => r.slopeDeg)),
      meanFuelUsedKg: mean(runs.map((r) => r.fuelUsedKg)),
      outcomes,
    };
  };

  const P = fly(planetary, planetary.id);
  const A = fly(analogSite, analog.id);
  const components = {
    successRate: agree(P.successRate, A.successRate, 1),
    ground: agree(P.meanSlopeDeg, A.meanSlopeDeg, lander.limits.maxSlopeDeg),
    fuel: agree(P.meanFuelUsedKg, A.meanFuelUsedKg, 0.5 * lander.fuelKg),
  };
  return {
    score: Math.round(100 * (0.5 * components.successRate + 0.3 * components.ground + 0.2 * components.fuel)),
    components,
    planetary: P,
    analog: A,
    gridSize: n,
    assumedRockAbundance: k,
    catalogTerrainScore: opts.catalogTerrainScore ?? null,
    gravity,
    airDensity,
    method:
      `${n * n} blind landings (no hazard sensor) spread over the middle of each terrain` +
      (k > 0 ? `, with an assumed ${(k * 100).toFixed(0)}% rock abundance on both` : '') +
      '; score = 50% landable share + 30% touchdown slope + 20% fuel used.',
  };
}
