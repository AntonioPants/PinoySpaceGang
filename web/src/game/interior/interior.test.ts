import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../lib/mission';
import type { MissionConfig } from '../../lib/types';
import { buildChecklist, overall } from './checklist';
import { clampToCabin, nearestStation, nextStation, poseFacing, shortestTurn, START_POSE, walk } from './firstPerson';
import { CABIN, STATIONS } from './stations';

const mission = (body: 'Moon' | 'Mars', gravity: number) => ({
  planetaryTarget: { id: 't', name: 'Target', body, gravity },
  earthAnalog: { id: 'a', name: 'Analog' }, evidence: { quantitativeSimilarityScore: null },
}) as unknown as MissionConfig;
const input = { mission: mission('Moon', 1.62), settings: defaultSettings, weatherAvailable: true, weatherLoaded: true, error: '' };

describe('walking the cabin', () => {
  it('never lets the player through a wall', () => {
    let pose = { ...START_POSE };
    for (let i = 0; i < 600; i++) pose = walk(pose, 1, 0, 1 / 60);      // ten seconds straight ahead
    expect(Math.hypot(pose.x, pose.z)).toBeLessThanOrEqual(CABIN.walkM + 1e-9);
    expect(CABIN.walkM).toBeLessThan(CABIN.wallM);
    expect(clampToCabin(0.5, 0.5)).toEqual({ x: 0.5, z: 0.5 });
  });
  it('walks the way the player faces, and sidesteps at right angles to it', () => {
    const east = { x: 0, z: 0, yaw: Math.PI / 2, pitch: 0 };
    const ahead = walk(east, 1, 0, 0.5), right = walk(east, 0, 1, 0.5);
    expect(ahead.x).toBeGreaterThan(0.5); expect(Math.abs(ahead.z)).toBeLessThan(1e-9);
    expect(right.z).toBeGreaterThan(0.5); expect(Math.abs(right.x)).toBeLessThan(1e-9);
  });
  it('stands in front of each monitor, inside the walkable area, facing it', () => {
    for (const s of STATIONS) {
      const pose = poseFacing(s.angleDeg);
      expect(Math.hypot(pose.x, pose.z)).toBeLessThanOrEqual(CABIN.walkM);
      expect(nearestStation(pose).id).toBe(s.id);
    }
  });
  it('cycles through the stations in order and wraps round', () => {
    expect(nextStation(null).id).toBe('mission');
    expect(STATIONS.map((_, i) => STATIONS.slice(0, i).reduce(id => nextStation(id).id, STATIONS[0].id))).toEqual(['mission', 'equipment', 'config', 'launch']);
    expect(nextStation('launch').id).toBe('mission');
    expect(nextStation('mission', -1).id).toBe('launch');
  });
  it('turns the short way round', () => {
    expect(shortestTurn(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(shortestTurn(-3, 3)).toBeCloseTo(-(2 * Math.PI - 6));
  });
});

describe('go / no-go checklist', () => {
  it('is go for the default mission', () => {
    const checks = buildChecklist(input);
    expect(overall(checks)).toBe('go');
    expect(checks.find(c => c.id === 'weather')!.detail).toMatch(/vacuum/);
  });
  it('cautions, but does not hold, when the vehicle cannot hover', () => {
    const checks = buildChecklist({ ...input, settings: { ...defaultSettings, environment: 'earth', thrusterForceN: 8000 } });
    expect(checks.find(c => c.id === 'thrust')!.status).toBe('caution');
    expect(overall(checks)).toBe('caution');
  });
  it('holds for real weather at a site with no profile, and for invalid settings', () => {
    const weather = buildChecklist({ ...input, weatherAvailable: false, settings: { ...defaultSettings, environment: 'earth', realWeatherMonth: 7 } });
    expect(weather.find(c => c.id === 'weather')!.status).toBe('hold');
    expect(overall(buildChecklist({ ...input, settings: { ...defaultSettings, fuelMassKg: -5 } }))).toBe('hold');
  });
  it("shows the parent's launch error as a hold", () => {
    const checks = buildChecklist({ ...input, error: 'This site has no weather profile.' });
    expect(checks.at(-1)).toMatchObject({ status: 'hold', detail: 'This site has no weather profile.' });
  });
  it('uses the gravity the descent will fly in', () => {
    const mars = buildChecklist({ ...input, mission: mission('Mars', 3.72) }).find(c => c.id === 'thrust')!;
    const earth = buildChecklist({ ...input, settings: { ...defaultSettings, environment: 'earth' } }).find(c => c.id === 'thrust')!;
    expect(mars.detail).toContain('3.72'); expect(earth.detail).toContain('9.81');
  });
});
