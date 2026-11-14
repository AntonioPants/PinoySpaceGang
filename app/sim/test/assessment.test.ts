import { describe, expect, it } from 'vitest';
import { assessFlight, runSim, syntheticTerrain, G0, SCORING } from '../src/index.ts';

const flat = () => syntheticTerrain({ body: 'moon', hillsM: 0, sizeM: 2000, cellSize: 10 });
const drop = { position: { x: 0, y: 0, z: 300 }, velocity: { x: 0, y: 0, z: 0 } };

describe('assessFlight', () => {
  it('grades a clean autonomous landing and reports margins within limits', () => {
    const flight = runSim({ site: flat(), strategy: 'autonomous', seed: 1 });
    const a = assessFlight(flight, { sensors: { hazard: 'lidar' } });
    expect(flight.summary!.outcome).toBe('success');
    expect(a.causes).toEqual([]);
    expect(a.margins).toHaveLength(5);
    expect(a.margins.every(m => m.ratio <= 1 && m.status !== 'exceeded')).toBe(true);
    expect(a.limitingFactor!.ratio).toBe(Math.max(...a.margins.map(m => m.ratio)));
    expect(['A', 'B']).toContain(a.scores.grade);
    expect(a.scores.safety).toBe(flight.summary!.survivability);
  });

  it('derives delta-v, reserve and peaks from the telemetry', () => {
    const flight = runSim({ site: flat(), strategy: 'autonomous', seed: 1 });
    const { stats } = assessFlight(flight);
    const s = flight.summary!, l = flight.lander;
    expect(stats.deltaVUsedMps).toBeCloseTo(l.ispS * G0 * Math.log((l.dryMassKg + l.fuelKg) / (l.dryMassKg + s.fuelRemainingKg)), 6);
    expect(stats.fuelReserveFraction).toBeCloseTo(s.fuelRemainingKg / l.fuelKg, 9);
    // start state: 1000 m up at (25, 0, -20) m/s on the Moon
    expect(stats.deltaVIdealMps).toBeCloseTo(Math.sqrt(25 ** 2 + 20 ** 2 + 2 * 1.62 * 1000), 0);
    expect(stats.propulsiveEfficiency!).toBeGreaterThan(0);
    expect(stats.propulsiveEfficiency!).toBeLessThanOrEqual(1);
    expect(stats.peakDescentRateMps).toBeGreaterThanOrEqual(20);
    expect(stats.burnTimeS).toBeGreaterThan(0);
    expect(stats.burnTimeS).toBeLessThanOrEqual(s.flightTimeS);
    expect(stats.peakDecelG).toBeGreaterThan(0);
    expect(stats.peakDecelG).toBeLessThan(l.maxThrustN / (l.dryMassKg * G0) + 0.1);
  });

  it('explains a fuel-starved crash and caps its score', () => {
    const flight = runSim({ site: flat(), strategy: 'autonomous', seed: 1, lander: { fuelKg: 20 } });
    const a = assessFlight(flight);
    expect(a.outcome).toBe('crash');
    expect(a.causes.map(c => c.code)).toContain('fuel-out');
    expect(a.recommendations.map(r => r.code)).toContain('more-fuel');
    expect(a.stats.fuelOutAltitudeM!).toBeGreaterThan(1);
    expect(a.scores.overall).toBeLessThanOrEqual(SCORING.outcomeCap.crash);
    expect(a.scores.efficiency).toBeNull();
    expect(a.scores.grade).toBe('F');
  });

  it('blames late braking when an engine-off drop hits too fast with fuel aboard', () => {
    const flight = runSim({ site: flat(), strategy: 'manual', start: drop }, { manual: () => ({ throttle: 0, tiltX: 0, tiltY: 0 }) });
    const a = assessFlight(flight);
    expect(a.outcome).toBe('crash');
    expect(a.margins.find(m => m.key === 'vertical')!.status).toBe('exceeded');
    expect(a.causes.map(c => c.code)).toEqual(['late-braking']);
    expect(a.stats.burnTimeS).toBe(0);
    expect(a.stats.propulsiveEfficiency).toBeNull();
  });

  it('reports a timeout without touchdown margins', () => {
    const flight = runSim({ site: flat(), strategy: 'manual', start: drop, gravity: 0.0001, maxTimeS: 5 }, { manual: () => ({ throttle: 0, tiltX: 0, tiltY: 0 }) });
    const a = assessFlight(flight);
    expect(a.outcome).toBe('timeout');
    expect(a.touchedDown).toBe(false);
    expect(a.margins).toEqual([]);
    expect(a.limitingFactor).toBeNull();
    expect(a.scores.overall).toBe(0);
    expect(a.causes[0].code).toBe('no-touchdown');
  });

  it('points at the missing hazard sensor when blind guidance lands on bad ground', () => {
    const site = syntheticTerrain({ body: 'moon', hillsM: 120, sizeM: 2000, cellSize: 10 });
    for (let seed = 1; seed <= 40; seed++) {
      const flight = runSim({ site, strategy: 'autonomous', seed, sensors: { hazard: 'none' }, target: { x: seed * 17 - 300, y: seed * 11 - 200 } });
      const a = assessFlight(flight, { sensors: { hazard: 'none' } });
      if (!a.margins.some(m => (m.key === 'slope' || m.key === 'roughness') && m.status === 'exceeded')) continue;
      expect(a.causes.map(c => c.code)).toEqual(expect.arrayContaining(['bad-ground', 'no-hazard-sensor']));
      expect(a.recommendations.map(r => r.code)).toContain('fit-sensor');
      return;
    }
    throw new Error('no blind landing hit bad ground; make the test terrain rougher');
  });
});
