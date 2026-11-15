import { describe, expect, it } from 'vitest';
import { createSensorModel } from '../src/sensors.ts';
import { createRng } from '../src/rng.ts';
import { HAZARD_SENSORS, HAZARD_SENSOR_IDS, gearCapability, gearConfig, GEAR_PRESETS, dynamicSlopeLimitDeg, runSim, syntheticTerrain, validateGear } from '../src/index.ts';
import type { HazardSensorId, SimState } from '../src/types.ts';

/** Spread of the velocity readings a sensor gives in the dust kicked up near the ground. */
function velocityNoise(hazard: HazardSensorId, dust: number) {
  const observe = createSensorModel({ hazard, velocimeter: true }, { dust, glare: 0 }, createRng(7));
  const state = { t: 0, position: { x: 0, y: 0, z: 5 }, velocity: { x: 0, y: 0, z: -1 }, altitudeAGL: 5, throttle: 0.5, tiltX: 0, tiltY: 0, fuelKg: 100, massKg: 1000 } as unknown as SimState;
  let sum = 0;
  for (let i = 0; i < 4000; i++) { state.t = i / 120; sum += observe(state).velocity.x ** 2; }
  return Math.sqrt(sum / 4000);
}

describe('hazard and descent sensors', () => {
  it('keeps the original three sensors on their original figures', () => {
    expect(HAZARD_SENSORS.lidar).toMatchObject({ map: true, glareNoiseM: 0.15, baseNoiseM: 0, cellM: 1.5, scanAltitudeM: 250, divertRadiusM: 120, velocitySigmaMps: 0.03 });
    expect(HAZARD_SENSORS.camera).toMatchObject({ map: true, glareNoiseM: 1 });
    expect(HAZARD_SENSORS.none.map).toBe(false);
  });

  it('radar holds its velocity through plume dust where an optical sensor does not', () => {
    expect(velocityNoise('landing-radar', 0.8)).toBeLessThan(velocityNoise('lidar', 0.8) * 0.6);
    // in clear air the Doppler lidar is the most precise of all
    const clear = HAZARD_SENSOR_IDS.map(id => [id, velocityNoise(id, 0)] as const).sort((a, b) => a[1] - b[1]);
    expect(clear[0][0]).toBe('doppler-lidar');
  });

  it('only sensors that map the ground let guidance divert', () => {
    const site = syntheticTerrain({ body: 'moon', hillsM: 120, sizeM: 2000, cellSize: 10, craters: 8 });
    for (const hazard of HAZARD_SENSOR_IDS) {
      const flights = [1, 2, 3, 4, 5].map(seed => runSim({ site, strategy: 'autonomous', seed, sensors: { hazard }, target: { x: seed * 37 - 100, y: seed * 23 - 60 } }));
      const diverted = flights.some(f => f.summary!.diverted);
      if (!HAZARD_SENSORS[hazard].map) expect(diverted, hazard).toBe(false);
      // a divert never goes further than the sensor allows
      for (const f of flights) for (const e of f.events) if (e.type === 'divert') expect(e.distanceM, hazard).toBeLessThanOrEqual(HAZARD_SENSORS[hazard].divertRadiusM * Math.SQRT2 + 1);
    }
  });

  it('flies every sensor to a finished flight', () => {
    const site = syntheticTerrain({ body: 'moon', hillsM: 0, sizeM: 2000, cellSize: 10 });
    for (const hazard of HAZARD_SENSOR_IDS) {
      const flight = runSim({ site, strategy: 'autonomous', seed: 3, sensors: { hazard } });
      expect(flight.summary!.outcome, hazard).not.toBe('timeout');
    }
  });
});

describe('landing gear after real missions', () => {
  it('are all valid gear and keep their character', () => {
    for (const preset of Object.values(GEAR_PRESETS)) expect(validateGear(preset), preset.gearId).toEqual([]);
    const cap = (id: keyof typeof GEAR_PRESETS) => gearCapability(gearConfig(id));
    // Apollo's long crushable stroke takes the hardest touchdown of all
    expect(Math.max(...Object.keys(GEAR_PRESETS).map(id => cap(id as keyof typeof GEAR_PRESETS).maxSinkMps))).toBe(cap('apollo-four').maxSinkMps);
    // Vikram's strengthened legs take about 3 m/s
    expect(cap('vikram-four').maxSinkMps).toBeGreaterThan(3);
    // a tripod tips sooner than a four-leg gear of the same size
    expect(cap('surveyor-three').staticTipDeg).toBeLessThan(cap('standard-four').staticTipDeg);
    // Nova-C's light, short-stroke legs hold less slope than Apollo's on the Moon
    expect(dynamicSlopeLimitDeg(gearConfig('nova-six'), 1.62)).toBeLessThan(dynamicSlopeLimitDeg(gearConfig('apollo-four'), 1.62));
  });

  it('change the flight: a heavier gear rides along as mass', () => {
    const site = syntheticTerrain({ body: 'moon', hillsM: 0, sizeM: 2000, cellSize: 10 });
    const fly = (id: keyof typeof GEAR_PRESETS) => runSim({ site, strategy: 'autonomous', seed: 2, lander: { gear: gearConfig(id) } });
    expect(fly('apollo-four').summary!.fuelRemainingKg).toBeLessThan(fly('slim-five').summary!.fuelRemainingKg);
  });
});
