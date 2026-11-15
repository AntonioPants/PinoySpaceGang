import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { targets, catalogSites } from '../data/sites';
import { buildMission, defaultSettings, loadProfile } from './mission';
import { insideLandingArea } from './landing';
import { withGear, type GearPresetId } from './gear';
import { toSimInput } from './simulation';
import { runSim } from '../../../app/sim/src/engine';

afterEach(() => vi.unstubAllGlobals());

/**
 * The game's own path for "flag a red-dotted slope and see if the lander topples": the real
 * Kilbourne Hole pack, a landing flag on its crater wall, guidance flying blind (no hazard
 * sensor, so it does not steer off the slope), under lunar gravity.
 */
describe('landing on flagged steep ground', () => {
  it('topples the standard gear on the crater wall and holds the wide gear there', async () => {
    vi.stubGlobal('fetch', async (url: string) => new Response(readFileSync(new URL(`../../public${url}`, import.meta.url))));
    const profile = await loadProfile(undefined, '/terrain/kilbourne-hole-v1/manifest.json', 'kilbourne-hole-v1');
    const entry = catalogSites.find(s => s.id === 'kilbourne-hole-v1');
    const target = targets.find(t => t.id === 'shackleton-rim')!;
    const { rows, columns, spacing_m: spacing } = profile.manifest.grid, data = new DataView(profile.buffer);
    const at = (c: number, r: number) => data.getFloat32((r * columns + c) * 4, true);
    // Selectable cells by slope (the same central difference the red dots use), steepest first.
    const cells: { x: number; y: number; slope: number }[] = [];
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < columns - 1; c++) {
      const point = { x: (c - (columns - 1) / 2) * spacing, y: ((rows - 1) / 2 - r) * spacing };
      if (!insideLandingArea(profile, point)) continue;
      const slope = Math.atan(Math.hypot(at(c + 1, r) - at(c - 1, r), at(c, r + 1) - at(c, r - 1)) / (2 * spacing)) * 180 / Math.PI;
      cells.push({ ...point, slope });
    }
    const fly = (gear: GearPresetId, landingTarget: { x: number; y: number }) => {
      const settings = { ...withGear(defaultSettings, gear), hazardSensor: 'none' as const };
      return runSim(toSimInput(buildMission(target, profile, settings, { landingTarget }), profile, entry)).summary!;
    };
    // a wall cell of 16 to 19 degrees: past the standard gear, inside the wide one
    const wall = cells.filter(c => c.slope >= 16 && c.slope <= 19).sort((a, b) => a.slope - b.slope);
    expect(wall.length).toBeGreaterThan(0);
    const outcomes = wall.slice(0, 3).map(c => ({ slope: c.slope, standard: fly('standard-four', c), wide: fly('wide-four', c) }));
    const landedOnSlope = outcomes.filter(o => o.standard.slopeDeg >= 14 && o.wide.slopeDeg >= 14);
    expect(landedOnSlope.length).toBeGreaterThan(0);
    const split = landedOnSlope.filter(o => o.standard.outcome === 'tip-over' && o.wide.outcome === 'success');
    expect(split.length).toBeGreaterThan(0);
    expect(split[0].standard.gear!.tipped).toBe(true);
    expect(split[0].standard.failureReasons.join(' ')).toMatch(/tipped over/);
    expect(split[0].wide.gear!.tipMarginDeg).toBeGreaterThan(0);
    // and flat ground in the crater floor is fine on either
    const floor = cells.filter(c => c.slope < 1 && Math.hypot(c.x, c.y) < 400)[0];
    expect(fly('standard-four', floor).outcome).toBe('success');
  }, 120_000);
});
