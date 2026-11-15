import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TerrainPack } from '../components/cutscene/terrainPack';
import { comparisonBounds, comparisonHeight, sampleTerrain } from './terrainComparison';
import { buildTerrainHologram, disposeHologram } from './terrainComparison3D';
import { Mesh, LineSegments } from 'three';
import catalog from '../../public/sites.json';

function pack(spacing: number, heights: number[]): TerrainPack {
  return {manifest:{id:'test',name:'Test',attribution:'Test',grid:{rows:3,columns:3,spacing_m:spacing}},heights:new Float32Array(heights),heightAt:()=>null};
}
const earth = pack(10,[100,110,120,130,140,150,160,170,180]);
const moon = pack(20,[900,920,940,960,980,1000,1020,1040,1060]);
describe('terrain comparison coordinates and units', () => {
  it('uses north-to-south rows, interpolates and includes exact edges', () => {
    expect(sampleTerrain(earth,-10,10)).toBe(100);
    expect(sampleTerrain(earth,10,-10)).toBe(180);
    expect(sampleTerrain(earth,5,5)).toBe(130);
    expect(sampleTerrain(earth,11,0)).toBeNull();
    expect(sampleTerrain(earth,NaN,0)).toBeNull();
  });
  it('aligns centre elevations while preserving metre scale and clips to both grids', () => {
    expect(comparisonHeight(moon,earth,0,0)).toBe(140);
    expect(comparisonHeight(moon,earth,10,0)).toBe(150);
    expect(comparisonHeight(moon,earth,0,10)).toBe(110);
    expect(comparisonHeight(moon,earth,11,0)).toBeNull();
    expect(comparisonBounds(earth,moon)).toEqual({halfWidth:10,halfDepth:10});
    expect(comparisonHeight(earth,moon,11,0)).toBeNull();
  });
  it('keeps the hologram registered to a non-centre landing target without mutating DEMs', () => {
    const before = Array.from(earth.heights);
    const group = buildTerrainHologram(earth,moon,{target:{x:5,y:-3},elevation:150});
    const surface = group.children[0] as Mesh;
    const position = surface.geometry.attributes.position;
    expect(position.getX(0)).toBe(-15);
    expect(position.getZ(0)).toBe(-13);
    expect(position.getY(4)).toBe(-10);
    expect((surface.material as import('three').MeshBasicMaterial).depthWrite).toBe(false);
    expect(Array.from(earth.heights)).toEqual(before);
    const lines = group.children[1] as LineSegments;
    expect(lines.geometry.index!.count).toBeGreaterThan(0);
    disposeHologram(group);
  });
  for (const entry of catalog.sites.filter(s => s.role==='planetary_target')) {
    it(`loads real ${entry.id} heights without stretching the footprint`, () => {
      const dir = resolve('public',entry.terrain!.manifest_url.slice(1),'..');
      const manifest = JSON.parse(readFileSync(resolve(dir,'manifest.json'),'utf8'));
      const bytes = readFileSync(resolve(dir,manifest.grid.sample_file));
      const heights = Float32Array.from({length:bytes.length/4},(_,i)=>bytes.readFloatLE(i*4));
      const planetary: TerrainPack = {manifest,heights,heightAt:()=>null};
      expect(sampleTerrain(planetary,0,0)).toBe(heights[16*33+16]);
      const group = buildTerrainHologram(earth,planetary,{elevation:140});
      const positions = (group.children[0] as Mesh).geometry.attributes.position;
      for(let i=0;i<positions.count;i++) expect(Number.isFinite(positions.getY(i))).toBe(true);
      expect(positions.getX(positions.count-1)-positions.getX(0)).toBe(20);
      disposeHologram(group);
    });
  }
});
