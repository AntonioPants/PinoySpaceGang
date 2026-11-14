import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { profileToSite, terrainPackToSite, runSim, GridTerrain } from '../src/index.ts';

const PACK = new URL('../../../web/public/terrain/kilbourne-hole-v1/', import.meta.url);

describe('terrain loaders', () => {
  it('loads the Kilbourne Hole terrain pack (north row flipped to +y)', () => {
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', PACK), 'utf8'));
    const buf = readFileSync(new URL('elevation.f32', PACK));
    const raw = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const site = terrainPackToSite(manifest, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), { analogOf: 'moon' });
    expect(site.heightmap.cols).toBe(161);
    expect(site.heightmap.cellSize).toBe(30);
    const t = new GridTerrain(site.heightmap);
    const { maxY, minX } = t.bounds();
    // north-west sample of the file is the first value
    expect(t.heightAt(minX, maxY)).toBeCloseTo(raw[0], 3);
    const tel = runSim({ site, strategy: 'autonomous' });
    expect(tel.environment.gravity).toBe(1.62);
    expect(tel.summary).toBeDefined();
  });

  it('converts a complete terrain_profile document without inventing samples', () => {
    const profile = {
      site: { id: 'test_site', name: 'Test', type: 'earth_analog' as const, body: 'earth' as const },
      spatial: { width: 3, height: 2, resolution_m: { x: 10, y: 10 } },
      terrain: { elevation_m: [[5, 5, 5], [1, 2, 3]] },
    };
    const site = profileToSite(profile, { analogOf: 'mars' });
    expect(site.analogOf).toBe('mars');
    const h = Array.from(site.heightmap.heights);
    expect(h.slice(0, 3)).toEqual([1, 2, 3]); // south row first
    expect(h.slice(3)).toEqual([5, 5, 5]);
  });
});

 describe('strict missing-data handling', () => {
   const profile = { site: { id:'test', name:'Test', type:'earth_analog' as const, body:'earth' as const }, spatial:{width:2,height:2,resolution_m:{x:30,y:30}}, terrain:{elevation_m:[[1,2],[3,4]] as (number|null)[][]} };
   it.each([null,NaN,Infinity,-Infinity])('rejects missing/nonfinite elevation %s', value => {
     const p = structuredClone(profile); p.terrain.elevation_m[1][0] = value;
     expect(() => profileToSite(p)).toThrow('no synthetic filling');
   });
   it('rejects a malformed optional roughness layer instead of replacing unknowns with zero', () => {
     expect(() => profileToSite({...profile,terrain:{...profile.terrain,roughness_rms_m:[[0,null],[0,0]]}})).toThrow('roughness');
   });
   it('rejects malformed rows and overflowing sample values', () => {
     expect(() => profileToSite({...profile,terrain:{elevation_m:[[1],[2]]}})).toThrow('columns');
     expect(() => profileToSite({...profile,terrain:{elevation_m:[[1,1e100],[3,4]]}})).toThrow('float32');
   });
 });
