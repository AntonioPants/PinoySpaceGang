import { describe, expect, it } from 'vitest';
import * as T from 'three';
import type { TerrainProfile } from '../../lib/types';
import { elevationOver, globePoint, siteSwoop, EARTH_CENTRE, EARTH_RADIUS, METRE_SCALE, type CameraPose } from './earthSurface';
import { regionPatch } from './regions';
import { buildLandingPicker } from './landingPick';

describe('swoop to a surface site', () => {
  const site = globePoint(32, -107, EARTH_RADIUS).add(EARTH_CENTRE), normal = globePoint(32, -107, 1);
  const orbit: CameraPose = { position: globePoint(26, -100, 5.5).add(EARTH_CENTRE), target: EARTH_CENTRE.clone(), up: new T.Vector3(0, 1, 0) };
  const side = new T.Vector3().crossVectors(normal, new T.Vector3(0, 1, 0)).normalize();
  const ground: CameraPose = { position: site.clone().addScaledVector(normal, 1500 * METRE_SCALE).addScaledVector(side, 3700 * METRE_SCALE), target: site.clone(), up: normal.clone() };
  it('has exact endpoints in both directions and never enters Earth', () => {
    for (const [from, to] of [[orbit, ground], [ground, orbit]]) {
      expect(siteSwoop(from, to, site, 0).position.distanceTo(from.position)).toBeLessThan(1e-9);
      expect(siteSwoop(from, to, site, 0).target.distanceTo(from.target)).toBeLessThan(1e-9);
      expect(siteSwoop(from, to, site, 1).position.distanceTo(to.position)).toBeLessThan(1e-9);
      expect(siteSwoop(from, to, site, 1).target.distanceTo(to.target)).toBeLessThan(1e-9);
      for (let i = 0; i <= 500; i++) {
        const at = siteSwoop(from, to, site, i / 500);
        expect(at.position.distanceTo(EARTH_CENTRE)).toBeGreaterThan(EARTH_RADIUS);
        expect(at.up.length()).toBeCloseTo(1, 8);
      }
    }
  });
  it('is already looking at the site, from a slant, well before it arrives', () => {
    // The old path dropped straight down and only turned to its final view in the last frames.
    const late = siteSwoop(orbit, ground, site, .8);
    expect(late.target.distanceTo(site)).toBeLessThan(1e-9);
    expect(elevationOver(late.position, site)).toBeLessThan(.75);
    // and each step near the end is a small one
    const a = siteSwoop(orbit, ground, site, .98), b = siteSwoop(orbit, ground, site, 1);
    expect(a.position.clone().sub(site).angleTo(b.position.clone().sub(site))).toBeLessThan(.01);
  });
});

describe('site regions on a globe', () => {
  it('lies on the sphere around the site, even at a pole', () => {
    for (const [lat, lon] of [[18.45, 77.4], [-89.55, 0]]) {
      const region = regionPatch('site', lat, lon, 1.18, 5.5), centre = globePoint(lat, lon, 1);
      region.traverse(o => {
        if (!(o instanceof T.Mesh)) return;
        const p = o.geometry.getAttribute('position'), v = new T.Vector3();
        expect(o.userData.id).toBe('site');
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          expect(v.length()).toBeGreaterThan(1.18); expect(v.length()).toBeLessThan(1.18 * 1.01);
          expect(T.MathUtils.radToDeg(v.angleTo(centre))).toBeLessThan(5.5 * Math.SQRT2 + .1);
        }
      });
    }
  });
});

describe('landing point picker', () => {
  // 161 x 161 at 30 m, rising 1 m per column eastwards.
  const heights = new Float32Array(161 * 161);
  for (let r = 0; r < 161; r++) for (let c = 0; c < 161; c++) heights[r * 161 + c] = 100 + c;
  const profile = { buffer: heights.buffer, manifest: { grid: { rows: 161, columns: 161, spacing_m: 30 } } } as TerrainProfile;
  const picker = buildLandingPicker(profile);
  it('finds the ground a ray meets, in the patch frame', () => {
    const origin = new T.Vector3(900, 3000, 2600), aim = new T.Vector3(600, 100, -300);
    const point = picker.pick(origin, aim.clone().sub(origin).normalize())!;
    // column = (x + 2400) / 30, height above the lowest sample = column
    expect(point.y).toBeCloseTo((point.x + 2400) / 30, 0);
    expect(point.distanceTo(aim)).toBeLessThan(40);
    expect(picker.inArea(point)).toBe(true);
  });
  it('marks only the cells steeper than the standard gear rating', () => {
    // 1 m per 30 m column is under 2 degrees: nothing to mark
    expect(picker.steepCells).toBe(0);
    // a cliff down the middle: 40 m in one cell is over 30 degrees across the two columns beside it
    const stepped = new Float32Array(161 * 161);
    for (let r = 0; r < 161; r++) for (let c = 0; c < 161; c++) stepped[r * 161 + c] = c < 80 ? 0 : 40;
    const cliff = buildLandingPicker({ buffer: stepped.buffer, manifest: { grid: { rows: 161, columns: 161, spacing_m: 30 } } } as TerrainProfile);
    expect(cliff.steepCells).toBe(2 * 159);
  });
  it('ignores rays that miss the patch and points outside the selectable area', () => {
    expect(picker.pick(new T.Vector3(0, 3000, 9000), new T.Vector3(0, 0, 1))).toBeNull();
    expect(picker.inArea({ x: 2000, z: 0 })).toBe(false);
  });
});
