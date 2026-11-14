import { describe, expect, it } from 'vitest';
import { createSim, G0, syntheticTerrain, DEFAULT_LANDER } from '../src/index.ts';

const flat = (body: 'moon' | 'mars' | 'earth' = 'moon') =>
  syntheticTerrain({ body, hillsM: 0, sizeM: 2000, cellSize: 10 });

describe('physics', () => {
  it('free fall matches h = ½gt² on the Moon', () => {
    const sim = createSim(
      { site: flat(), strategy: 'manual', start: { position: { x: 0, y: 0, z: 500 }, velocity: { x: 0, y: 0, z: 0 } } },
    );
    const T = 10;
    while (sim.state.t < T - 1e-9) sim.step({ throttle: 0, tiltX: 0, tiltY: 0 });
    const fallen = 500 - sim.state.altitudeAGL;
    expect(fallen).toBeCloseTo(0.5 * 1.62 * T * T, 0);
    expect(sim.state.velocity.z).toBeCloseTo(-1.62 * T, 3);
  });

  it('burns fuel at mdot = T / (Isp·g0)', () => {
    const sim = createSim({
      site: flat(),
      strategy: 'manual',
      start: { position: { x: 0, y: 0, z: 5000 }, velocity: { x: 0, y: 0, z: 0 } },
    });
    const T = 20;
    while (sim.state.t < T - 1e-9) sim.step({ throttle: 0.5, tiltX: 0, tiltY: 0 });
    const expected = ((0.5 * DEFAULT_LANDER.maxThrustN) / (DEFAULT_LANDER.ispS * G0)) * T;
    expect(DEFAULT_LANDER.fuelKg - sim.state.fuelKg).toBeCloseTo(expected, 1);
  });

  it('a fast impact is a crash and emits crash', () => {
    const sim = createSim({
      site: flat(),
      strategy: 'manual',
      start: { position: { x: 0, y: 0, z: 100 }, velocity: { x: 0, y: 0, z: -20 } },
    });
    while (!sim.state.done) sim.step({ throttle: 0, tiltX: 0, tiltY: 0 });
    const tel = sim.telemetry();
    expect(tel.summary?.outcome).toBe('crash');
    expect(tel.events.some((e) => e.type === 'crash')).toBe(true);
  });

  it('settling gently on a steep slope tips over', () => {
    const site = syntheticTerrain({ hillsM: 0, baseSlopeDeg: 20, sizeM: 400, cellSize: 2 });
    const sim = createSim({
      site,
      strategy: 'manual',
      start: { position: { x: 0, y: 0, z: 0.5 }, velocity: { x: 0, y: 0, z: -0.5 } },
    });
    while (!sim.state.done) sim.step({ throttle: 0, tiltX: 0, tiltY: 0 });
    expect(sim.state.outcome).toBe('tip-over');
    expect(sim.events.some((e) => e.type === 'tipOver')).toBe(true);
  });

  it('wind pushes the lander through drag on Earth but not on the airless Moon', () => {
    const run = (body: 'moon' | 'earth') => {
      const site = { ...flat(body), wind: { x: 15, y: 0 } };
      const sim = createSim({
        site,
        strategy: 'manual',
        gravity: 'native',
        atmosphere: 'native',
        start: { position: { x: 0, y: 0, z: 1000 }, velocity: { x: 0, y: 0, z: 0 } },
      });
      while (sim.state.t < 5) sim.step({ throttle: 0, tiltX: 0, tiltY: 0 });
      return sim.state.velocity.x;
    };
    expect(run('moon')).toBe(0);
    expect(run('earth')).toBeGreaterThan(0.5);
  });

  it('Earth analog sites simulate the target body by default', () => {
    const site = syntheticTerrain({ body: 'earth', analogOf: 'mars', hillsM: 0, sizeM: 200, cellSize: 10 });
    expect(createSim({ site, strategy: 'manual' }).gravity).toBe(3.71);
    expect(createSim({ site, strategy: 'manual', gravity: 'native' }).gravity).toBe(9.81);
    expect(createSim({ site, strategy: 'manual', gravity: 2 }).gravity).toBe(2);
  });

  it('advance() steps a render frame with a fixed-step accumulator', () => {
    const sim = createSim({ site: flat(), strategy: 'manual', dt: 0.01 });
    sim.advance(1 / 60, { throttle: 0, tiltX: 0, tiltY: 0 });
    sim.advance(1 / 60, { throttle: 0, tiltX: 0, tiltY: 0 });
    expect(sim.state.t).toBeCloseTo(0.03, 6);
  });
});
