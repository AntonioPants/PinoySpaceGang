import { describe, expect, it } from 'vitest';
import {
  Surface, cumulativeRockArea, runSim, syntheticTerrain, siteInterference, evaluateTouchdown, DEFAULT_LANDER,
} from '../src/index.ts';

const flat = (k?: number) => ({ ...syntheticTerrain({ hillsM: 0, sizeM: 1000, cellSize: 5 }), rockAbundance: k });

describe('Golombek–Rapp boulder field', () => {
  it('F_k(0) equals the rock abundance k', () => {
    expect(cumulativeRockArea(0.1, 0)).toBeCloseTo(0.1, 10);
  });

  it('generated rocks cover roughly the area the model predicts', () => {
    const k = 0.08;
    const s = new Surface(flat(k), { seed: 3 });
    const R = 300;
    const covered = s.rocks!.rocks.reduce((a, r) => a + (Math.PI * r.d * r.d) / 4, 0) / (2 * R) ** 2;
    const expected = cumulativeRockArea(k, 0.7) - cumulativeRockArea(k, 4);
    expect(covered / expected).toBeGreaterThan(0.85);
    expect(covered / expected).toBeLessThan(1.15);
  });

  it('is deterministic per seed and scales with abundance', () => {
    const a = new Surface(flat(0.05), { seed: 1 }).rocks!.rocks.length;
    expect(new Surface(flat(0.05), { seed: 1 }).rocks!.rocks.length).toBe(a);
    expect(new Surface(flat(0.15), { seed: 1 }).rocks!.rocks.length).toBeGreaterThan(a * 2);
    expect(new Surface(flat(0), { seed: 1 }).rocks).toBeNull();
  });

  it('a lander set down blind in a rock field hits a boulder', () => {
    const tel = runSim({ site: flat(0.2), strategy: 'autonomous', sensors: { hazard: 'none' }, seed: 4 });
    expect(tel.environment.rocksGenerated).toBeGreaterThan(1000);
    expect(['tip-over', 'hard-landing', 'success']).toContain(tel.summary!.outcome);
    const blindFailures = [1, 2, 3, 4, 5, 6].filter(
      (seed) => runSim({ site: flat(0.2), strategy: 'autonomous', sensors: { hazard: 'none' }, seed }).summary!.outcome === 'tip-over',
    ).length;
    const lidarFailures = [1, 2, 3, 4, 5, 6].filter(
      (seed) => runSim({ site: flat(0.2), strategy: 'autonomous', sensors: { hazard: 'lidar' }, seed }).summary!.outcome === 'tip-over',
    ).length;
    expect(lidarFailures).toBeLessThan(blindFailures);
  });

  it('touchdown flags a rock under the footprint', () => {
    const r = evaluateTouchdown({ verticalSpeedMps: 1, horizontalSpeedMps: 0.1, slopeDeg: 1, roughnessM: 0.9, tiltDeg: 1 }, DEFAULT_LANDER.limits);
    expect(r.outcome).toBe('tip-over');
  });
});

describe('site environment', () => {
  it('derives dust from soil and glare from snow / low sun', () => {
    const base = syntheticTerrain({ body: 'earth', hillsM: 0, sizeM: 100, cellSize: 10 });
    expect(siteInterference({ ...base, soilType: 'basalt lava' }).dust).toBeLessThan(siteInterference({ ...base, soilType: 'fine silt' }).dust);
    const sunny = siteInterference({ ...base, albedo: 0.2, sunElevationDeg: 60 }).glare;
    const polarSnow = siteInterference({ ...base, albedo: 0.8, snowCover: 0.9, sunElevationDeg: 5 }).glare;
    expect(polarSnow).toBeGreaterThan(sunny + 0.5);
    expect(siteInterference({ ...base, snowCover: 1 }, { glare: 0 }).glare).toBe(0); // explicit override wins
  });
});
