import { describe, expect, it } from 'vitest';
import { createSim, runSim, syntheticTerrain, HAZARD_SENSORS, HAZARD_SENSOR_IDS } from '../src/index.ts';
import type { SimEvent } from '../src/types.ts';

/** Rough, cratered ground where the autopilot has to make choices. */
const rough = syntheticTerrain({ body: 'moon', hillsM: 140, sizeM: 2400, cellSize: 10, craters: 14 });
const target = (seed: number) => ({ x: (seed * 53) % 500 - 250, y: (seed * 31) % 400 - 200 });

function fly(hazard: (typeof HAZARD_SENSOR_IDS)[number], seed: number, glare = 0.2) {
  const sim = createSim({ site: rough, strategy: 'autonomous', seed, sensors: { hazard }, target: target(seed), interference: { dust: 0.2, glare } });
  const aims: { t: number; x: number; y: number }[] = [];
  while (!sim.state.done) { sim.step(); aims.push({ t: sim.state.t, ...sim.aim }); }
  return { sim, aims };
}

describe('what the sim exposes for sensor displays', () => {
  it('reports the sensor flying and how well it sees in glare', () => {
    for (const hazard of HAZARD_SENSOR_IDS) {
      const sim = createSim({ site: rough, strategy: 'autonomous', sensors: { hazard }, interference: { glare: 0.6 } });
      expect(sim.sensor.id).toBe(hazard);
      expect(sim.sensor.profile).toBe(HAZARD_SENSORS[hazard]);
      if (!HAZARD_SENSORS[hazard].map) { expect(sim.sensor.quality).toBe(0); expect(sim.hazardMap({ x: 0, y: 0 }, 50)).toEqual([]); }
    }
    const q = (hazard: 'camera' | 'lidar', glare: number) => createSim({ site: rough, strategy: 'autonomous', sensors: { hazard }, interference: { glare } }).sensor.quality;
    expect(q('camera', 0.8)).toBeLessThan(q('camera', 0.1));
    expect(q('lidar', 0.8)).toBeGreaterThan(q('camera', 0.8));
  });

  it("classifies the map with the autopilot's own test", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { sim } = fly('lidar', seed);
      const scan = sim.events.find((e): e is Extract<SimEvent, { type: 'siteSelected' }> => e.type === 'siteSelected')!;
      expect(scan).toBeDefined();
      // the cell at the original target agrees with whether the autopilot thought it safe
      const [here] = sim.hazardMap(target(seed), 0);
      const hazard = sim.events.some(e => e.type === 'hazardDetected');
      expect(here.safe).toBe(!hazard);
      // and the spot it chose is one the map calls safe
      if (scan.safe) expect(sim.hazardMap(scan.at, 0)[0].safe).toBe(true);
    }
  });

  it('reports one selected site per scan, at the actual aim, only for sensors that map', () => {
    for (const hazard of HAZARD_SENSOR_IDS) for (const seed of [1, 2, 3]) {
      const { sim, aims } = fly(hazard, seed);
      const selected = sim.events.filter(e => e.type === 'siteSelected');
      expect(selected.length, hazard).toBe(HAZARD_SENSORS[hazard].map ? 1 : 0);
      for (const e of selected) if (e.type === 'siteSelected') {
        // the marker position is where guidance really aimed from then on
        const after = aims.filter(a => a.t > e.t);
        for (const a of after) { expect(a.x).toBeCloseTo(e.at.x, 9); expect(a.y).toBeCloseTo(e.at.y, 9); }
        const divert = sim.events.find(d => d.type === 'divert');
        expect(e.diverted).toBe(!!divert);
        if (divert?.type === 'divert') expect(e.at).toEqual(divert.to);
      }
    }
  });

  it('leaves every flight exactly as it was: reading the displays changes nothing', () => {
    for (const hazard of ['lidar', 'hazard-camera', 'terrain-nav'] as const) {
      const plain = runSim({ site: rough, strategy: 'autonomous', seed: 4, sensors: { hazard }, target: target(4), interference: { dust: 0.3, glare: 0.4 } });
      const sim = createSim({ site: rough, strategy: 'autonomous', seed: 4, sensors: { hazard }, target: target(4), interference: { dust: 0.3, glare: 0.4 } });
      for (let i = 0; !sim.state.done; i++) { sim.step(); if (i % 60 === 0) { sim.hazardMap(sim.aim, 40, 8); sim.observe(); void sim.sensor.quality; } }
      const read = sim.telemetry();
      expect(read.summary).toEqual(plain.summary);
      expect(read.samples).toEqual(plain.samples);
    }
  });
});
