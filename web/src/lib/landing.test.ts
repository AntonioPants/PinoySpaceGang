import { describe, expect, it } from 'vitest';
import { buildMission, defaultSettings, extractProfile } from './mission';
import { flightSetup } from './simulation';
import { describeLanding, insideLandingArea, landingArea } from './landing';
import { targets } from '../data/sites';
import type { TerrainManifest } from './types';
import manifestJson from '../../public/terrain/kilbourne-hole-v1/manifest.json';

// A flat 161 x 161 patch at 30 m: 4.8 km across, like the catalog's Earth packs.
const manifest: TerrainManifest = { ...manifestJson, grid: { ...manifestJson.grid, rows: 161, columns: 161, spacing_m: 30 }, local_frame: { vertical_offset_m: 0 } };
const profile = extractProfile(manifest, new Float32Array(161 * 161).fill(5).buffer);

describe('player-chosen landing point', () => {
  it('keeps the selectable area 600 m inside the measured patch', () => {
    expect(landingArea(profile)).toEqual({ halfX: 1800, halfY: 1800 });
    expect(insideLandingArea(profile, { x: 1800, y: -1800 })).toBe(true);
    expect(insideLandingArea(profile, { x: 1801, y: 0 })).toBe(false);
    expect(insideLandingArea(profile, { x: NaN, y: 0 })).toBe(false);
  });
  it('lands at the patch centre unless a flag was placed', () => {
    const mission = buildMission(targets[0], profile, defaultSettings);
    expect(mission.earthAnalog.landingTargetM).toBeUndefined();
    expect(flightSetup(mission).target).toEqual({ x: 0, y: 0 });
    expect(flightSetup(mission).start?.position).toEqual({ x: -400, y: 0, z: 1000 });
    expect(buildMission(targets[0], profile, defaultSettings, { landingTarget: { x: 0, y: 0 } }).earthAnalog.landingTargetM).toBeUndefined();
  });
  it('flies to the flag, starting the same approach 400 m west of it', () => {
    const mission = buildMission(targets[0], profile, defaultSettings, { landingTarget: { x: 620, y: -340 } });
    expect(mission.earthAnalog.landingTargetM).toEqual({ x: 620, y: -340 });
    const setup = flightSetup(mission);
    expect(setup.target).toEqual({ x: 620, y: -340 });
    expect(setup.start?.position).toEqual({ x: 220, y: -340, z: 1000 });
  });
  it('refuses a flag outside the selectable area', () => {
    expect(() => buildMission(targets[0], profile, defaultSettings, { landingTarget: { x: 2300, y: 0 } })).toThrow('landing flag');
  });
  it('describes the flag in compass terms', () => {
    expect(describeLanding({ x: 0, y: 0 })).toBe('centre of the patch');
    expect(describeLanding({ x: 420, y: -310 })).toBe('420 m E, 310 m S of centre');
    expect(describeLanding({ x: -75, y: 0 })).toBe('75 m W of centre');
  });
});
