import { describe, expect, it } from 'vitest';
import { runSim, syntheticTerrain, createSim } from '../src/index.ts';
import type { SimEvent } from '../src/index.ts';

const boulders = [{ center: { x: 0, y: 0 }, radiusM: 25, count: 60 }];

describe('autopilot', { timeout: 30_000 }, () => {
  for (const body of ['moon', 'mars'] as const) {
    it(`lands within limits on ${body}`, () => {
      const tel = runSim({ site: syntheticTerrain({ body, craters: 6 }), strategy: 'autonomous' });
      const s = tel.summary!;
      expect(s.outcome).toBe('success');
      expect(s.verticalSpeedMps).toBeLessThan(3);
      expect(s.horizontalSpeedMps).toBeLessThan(1.2);
      expect(s.distanceFromTargetM).toBeLessThan(3);
    });
  }

  it('is deterministic for a given seed', () => {
    const input = { site: syntheticTerrain({ body: 'mars' }), strategy: 'autonomous' as const, interference: { dust: 0.8 }, seed: 42 };
    expect(runSim(input)).toEqual(runSim(input));
    expect(runSim({ ...input, seed: 43 }).summary).not.toEqual(runSim(input).summary);
  });

  it('diverts around a boulder field with lidar', () => {
    const tel = runSim({ site: syntheticTerrain({ boulderFields: boulders }), strategy: 'autonomous' });
    expect(tel.events.map((e) => e.type)).toEqual(expect.arrayContaining(['hazardDetected', 'divert']));
    expect(tel.summary!.diverted).toBe(true);
    expect(tel.summary!.outcome).toBe('success');
  });

  it('without a hazard sensor it lands on the boulders and tips over', () => {
    const tel = runSim({ site: syntheticTerrain({ boulderFields: boulders }), strategy: 'autonomous', sensors: { hazard: 'none' } });
    expect(tel.summary!.diverted).toBe(false);
    expect(tel.summary!.outcome).toBe('tip-over');
  });

  it('cannot hover in full Earth gravity with a lunar-class engine', () => {
    const site = syntheticTerrain({ body: 'earth', analogOf: 'moon' });
    const tel = runSim({ site, strategy: 'autonomous', gravity: 'native', atmosphere: 'native' });
    expect(tel.summary!.outcome).toBe('crash');
  });

  it('streams events to subscribers in order', () => {
    const sim = createSim({ site: syntheticTerrain({ body: 'mars' }), strategy: 'autonomous' });
    const seen: SimEvent['type'][] = [];
    sim.on((e) => seen.push(e.type));
    while (!sim.state.done) sim.step();
    expect(seen[0]).toBe('engineOn');
    expect(seen).toContain('dustKickup');
    expect(seen.at(-1)).toBe('touchdown');
    expect(sim.telemetry().samples.length).toBeGreaterThan(100);
  });
});

describe('observe()', { timeout: 30_000 }, () => {
  it('reading the HUD does not change the flight', () => {
    const input = { site: syntheticTerrain({ body: 'mars' }), strategy: 'autonomous' as const, interference: { dust: 1 }, seed: 5 };
    const a = createSim(input);
    const b = createSim(input);
    while (!a.state.done) a.step();
    while (!b.state.done) {
      b.observe();
      b.step();
    }
    expect(b.telemetry().summary).toEqual(a.telemetry().summary);
  });
});

describe('terrain following', { timeout: 30_000 }, () => {
  it('does not fly into rising ground while lining up on a slope', () => {
    // 10° is under the 12° limit, so a clean landing is possible if guidance holds AGL
    const tel = runSim({ site: syntheticTerrain({ hillsM: 1, baseSlopeDeg: 10 }), strategy: 'autonomous' });
    expect(tel.summary!.horizontalSpeedMps).toBeLessThan(1.2);
    expect(tel.summary!.outcome).toBe('success');
  });
});

describe('light, high-thrust vehicle', { timeout: 30_000 }, () => {
  it('brakes sideways without climbing back above its start height', () => {
    // thrust-to-weight of about 6 on the Moon: braking laterally must not launch it upwards
    const tel = runSim({
      site: syntheticTerrain({ body: 'moon', craters: 6 }), strategy: 'autonomous',
      lander: { dryMassKg: 800, fuelKg: 350, maxThrustN: 12000 },
    });
    expect(Math.max(...tel.samples.map((s) => s.altitudeAGL))).toBeLessThan(1010);
    expect(Math.max(...tel.samples.map((s) => s.vz))).toBeLessThan(3);
    expect(tel.summary!.outcome).toBe('success');
    expect(tel.summary!.distanceFromTargetM).toBeLessThan(3);
  });
});
