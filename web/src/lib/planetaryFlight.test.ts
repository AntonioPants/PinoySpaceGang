import { describe, expect, it } from 'vitest';
import { createPlanetaryFlight } from './planetaryFlight';
import type { TerrainPack } from '../components/cutscene/terrainPack';
import type { SimInput } from '../../../app/sim/src/types';

const pack=(id:string,heights:number[]):TerrainPack=>({manifest:{id,name:id,attribution:'test',grid:{rows:3,columns:3,spacing_m:500}},heights:Float32Array.from(heights),heightAt:()=>null});
describe('planetary comparison flight',()=>{
  it('uses the selected body and north-first terrain without modifying the real input',()=>{
    const earth=pack('earth',Array(9).fill(100));
    const planet=pack('planet',[1,2,3,4,5,6,7,8,9]);
    const input:SimInput={site:{id:'earth',name:'earth',body:'earth',heightmap:{rows:3,cols:3,cellSize:500,heights:new Float32Array(9)}},strategy:'autonomous',start:{position:{x:-400,y:0,z:1000},velocity:{x:25,y:0,z:-20}},target:{x:0,y:0}};
    const moon=createPlanetaryFlight(input,planet,earth,'moon');
    const mars=createPlanetaryFlight(input,planet,earth,'mars');
    expect(moon.gravity).toBe(1.62); expect(mars.gravity).toBe(3.72);
    expect(moon.terrain.baseHeightAt(0,500)).toBe(97);
    expect(moon.terrain.baseHeightAt(0,-500)).toBe(103);
    for(let i=0;i<120;i++) moon.step();
    expect(moon.state.t).toBeGreaterThan(0); expect(mars.state.t).toBe(0);
    expect(input.site.id).toBe('earth'); expect(planet.heights[0]).toBe(1);
  });
  it('rejects a flag outside the shared footprint',()=>{
    const p=pack('p',Array(9).fill(0));
    const input:SimInput={site:{id:'e',name:'e',body:'earth',heightmap:{rows:3,cols:3,cellSize:500,heights:new Float32Array(9)}},strategy:'autonomous',target:{x:1000,y:0}};
    expect(()=>createPlanetaryFlight(input,p,p,'mars')).toThrow(/cover/);
  });
});
