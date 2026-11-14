import { describe, expect, it } from 'vitest';
import * as T from 'three';
import type { TerrainProfile } from '../../lib/types';
import { earthSurface, earthFlight, globePoint, EARTH_CENTRE, EARTH_RADIUS, EARTH_METRES, type CameraPose } from './earthSurface';

describe('continuous Earth surface', () => {
  it('preserves measured relief, curves the surroundings and registers imagery at the selected coordinates', () => {
    const heights = new Float32Array([100,110,120,130,180,150,160,170,175]);
    const profile = { buffer: heights.buffer, manifest: { grid: { rows:3, columns:3, spacing_m:30 } } } as TerrainProfile;
    const { geometry, frame, relief } = earthSurface(profile, 32, 179.99);
    const p = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    let measured = 0;
    for (let i=0;i<p.count;i++) {
      const x = p.getX(i), z = p.getZ(i);
      if (Math.abs(x)<=30 && Math.abs(z)<=30) {
        const index = (z / 30 + 1) * 3 + x / 30 + 1;
        const curvature = Math.sqrt(EARTH_METRES**2 - x*x - z*z) - EARTH_METRES;
        expect(p.getY(i) - curvature).toBeCloseTo(heights[index] - 100, 4); measured++;
      }
      if (x===0 && z===0) {
        expect(uv.getX(i)).toBeCloseTo((179.99+180)/360, 6);
        expect(uv.getY(i)).toBeCloseTo((32+90)/180, 6);
      }
    }
    expect(measured).toBe(9); expect(relief).toBe(80);
    expect(new T.Vector3(0,1,0).applyQuaternion(frame).distanceTo(globePoint(32,179.99,1))).toBeLessThan(1e-10);
    expect(p.getY(0)).toBeLessThan(-100_000); // Curved horizon, not a flat slab.
    // Date-line triangles sample adjacent texels, not opposite ends of the image.
    for (let i=0;i<geometry.index!.count;i+=3) {
      const us = [0,1,2].map(k=>uv.getX(geometry.index!.getX(i+k)));
      expect(Math.max(...us)-Math.min(...us)).toBeLessThan(.1);
    }
    expect(Array.from(heights)).toEqual([100,110,120,130,180,150,160,170,175]);
    geometry.dispose();
  });

  it('keeps an opposite-side site flight above Earth, with exact endpoints and an interruptible return', () => {
    const pose = (lat:number,lon:number,altitude:number):CameraPose => ({
      position:globePoint(lat,lon,EARTH_RADIUS+altitude).add(EARTH_CENTRE),
      target:globePoint(lat,lon,EARTH_RADIUS).add(EARTH_CENTRE),up:globePoint(lat,lon,1),
    });
    const from=pose(32,-106,.0007),to=pose(-32,74,.001);
    let previous=from.position;
    for(let i=0;i<=1000;i++) {
      const current=earthFlight(from,to,i/1000);
      expect(current.position.distanceTo(EARTH_CENTRE)).toBeGreaterThan(EARTH_RADIUS);
      expect(current.position.distanceTo(previous)).toBeLessThan(.04);
      expect(current.up.length()).toBeCloseTo(1,8); previous=current.position;
    }
    expect(earthFlight(from,to,0).position.distanceTo(from.position)).toBeLessThan(1e-10);
    expect(earthFlight(from,to,1).position.distanceTo(to.position)).toBeLessThan(1e-10);
    const interrupted=earthFlight(from,to,.43),orbit=pose(20,60,4);
    expect(earthFlight(interrupted,orbit,0).position.distanceTo(interrupted.position)).toBeLessThan(1e-10);
    expect(earthFlight(interrupted,orbit,1).target.distanceTo(orbit.target)).toBeLessThan(1e-10);
  });
});
