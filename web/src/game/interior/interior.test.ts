import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../lib/mission';
import type { MissionConfig } from '../../lib/types';
import { buildChecklist, overall } from './checklist';
import { blocked, followCamera, headingOf, inReach, moveInRoom, SEAT_CAMERA, shortestTurn, standSpot, START, stationCamera } from './player';
import { ROOM, SEAT, STATIONS } from './stations';

const mission = (body: 'Moon' | 'Mars', gravity: number) => ({
  planetaryTarget: { id: 't', name: 'Target', body, gravity },
  earthAnalog: { id: 'a', name: 'Analog' }, evidence: { quantitativeSimilarityScore: null },
}) as unknown as MissionConfig;
const input = { mission: mission('Moon', 1.62), settings: defaultSettings, weatherAvailable: true, weatherLoaded: true, error: '' };

describe('walking the bridge', () => {
  it('never lets the astronaut through a wall or the furniture', () => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, -0.7], [-0.6, 0.8]]) {
      let p: { x: number; z: number } = { ...START };
      for (let i = 0; i < 900; i++) { p = moveInRoom(p, dx * 0.05, dz * 0.05); expect(blocked(p)).toBe(false); }
      expect(Math.abs(p.x)).toBeLessThan(ROOM.halfWidthM); expect(Math.abs(p.z)).toBeLessThan(ROOM.halfDepthM);
    }
    expect(blocked(START)).toBe(false);
    expect(blocked({ x: SEAT.x, z: SEAT.z })).toBe(true);
  });
  it('slides along an obstacle instead of stopping dead', () => {
    const wall = [{ x0: -5, x1: 5, z0: -1, z1: -0.5 }];
    const p = moveInRoom({ x: 0, z: 0 }, 0.2, -0.3, wall);
    expect(p).toEqual({ x: 0.2, z: 0 });
  });
  it('stands at each monitor on open floor, facing it, with the monitor in reach', () => {
    for (const s of STATIONS) {
      const spot = standSpot(s);
      expect(blocked(spot)).toBe(false);
      expect(Math.sin(spot.heading)).toBeCloseTo(-s.nx); expect(-Math.cos(spot.heading)).toBeCloseTo(-s.nz);
      expect(inReach(spot)).toMatchObject({ kind: 'station', id: s.id });
      const cam = stationCamera(s);
      expect(Math.abs(cam.x)).toBeLessThan(ROOM.halfWidthM); expect(Math.abs(cam.z)).toBeLessThan(ROOM.halfDepthM);
    }
  });
  it('offers the pilot seat from beside it, and nothing from the middle of the floor', () => {
    expect(inReach({ x: 0.9, z: SEAT.z + 0.3 })).toMatchObject({ kind: 'seat' });
    expect(inReach({ x: 0, z: 0.3 })).toBeNull();
  });
  it('keeps the follow camera inside the room and under the ceiling', () => {
    for (const yaw of [0, 1, 2, 3, 4, 5, 6]) for (const p of [START, { x: 5, z: 3.5 }, { x: -5, z: -3 }]) {
      const cam = followCamera(p, yaw, 0.6);
      expect(Math.abs(cam.x)).toBeLessThan(ROOM.halfWidthM); expect(Math.abs(cam.z)).toBeLessThan(ROOM.halfDepthM);
      expect(cam.y).toBeLessThan(ROOM.heightM);
    }
    expect(Math.abs(SEAT_CAMERA.x)).toBeLessThan(ROOM.halfWidthM); expect(SEAT_CAMERA.y).toBeLessThan(ROOM.heightM);
  });
  it('turns the short way round', () => {
    expect(shortestTurn(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(shortestTurn(-3, 3)).toBeCloseTo(-(2 * Math.PI - 6));
    expect(headingOf(1, 0)).toBeCloseTo(Math.PI / 2);
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
