import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {TerrainProfile} from '../../../lib/types';
import TerrainComparison3D from '../TerrainComparison3D';
import {prepareTerrain,heightAt,slopeGrid} from './data';
import {makeTerrainScene} from './scene';

function profile(values:number[],rows=3,columns=3):TerrainProfile{
  const buffer=new ArrayBuffer(values.length*4),view=new DataView(buffer);values.forEach((v,i)=>view.setFloat32(i*4,v,true));
  return {buffer,heightsM:[],sampleSpacingM:10,row:1,manifest:{schema_version:1,id:'asymmetric',name:'Asymmetric DEM',body:'earth',grid:{rows,columns,spacing_m:10,width_m:(columns-1)*10,depth_m:(rows-1)*10,dtype:'float32',byte_order:'little-endian',sample_file:'elevation.f32'},local_frame:{vertical_offset_m:0},source:{dataset:'Test DEM',vertical_datum:'Test'},limitations:[],attribution:'Test'}};
}
describe('terrain comparison data and geometry',()=>{
  it('keeps north-first rows and east/north telemetry oriented without flips or transposes',()=>{
    const d=prepareTerrain(profile([100,110,120,10,20,30,0,1,2]),undefined);
    expect(heightAt(d,-10,10)).toBeCloseTo(100-d.mean);
    expect(heightAt(d,10,10)).toBeCloseTo(120-d.mean);
    expect(heightAt(d,10,-10)).toBeCloseTo(2-d.mean);
    expect(heightAt(d,0,0)).toBeCloseTo(20-d.mean);
    expect(heightAt(d,11,0)).toBeNull();
    const scene=makeTerrainScene(d,[]);
    const mesh=scene.scene.children.find(c=>c.type==='Mesh') as import('three').Mesh;
    expect(mesh.geometry.attributes.position.getX(0)).toBe(-10);
    expect(mesh.geometry.attributes.position.getZ(0)).toBe(-10);
    expect(mesh.scale.toArray()).toEqual([1,1,1]);scene.dispose();
  });
  it('derives exact planar slopes including boundaries and p95',()=>{
    const d=prepareTerrain(profile([0,1,2,2,3,4,4,5,6]),undefined);
    const angle=Math.atan(Math.hypot(.1,.2))*180/Math.PI;
    for(const s of d.slopes)expect(s).toBeCloseTo(angle,5);
    expect(d.meanSlope).toBeCloseTo(angle,5);expect(d.p95Slope).toBeCloseTo(angle,5);
  });
  it('leaves nodata holes rather than making up safe ground or markers',()=>{
    const d=prepareTerrain(profile([0,1,2,3,NaN,5,6,7,8]),undefined);
    expect(d.missing).toBe(1);expect(heightAt(d,0,0)).toBeNull();
    const scene=makeTerrainScene(d,[{x:0,y:0},{x:999,y:0}]);expect(scene.omitted).toBe(2);
    const mesh=scene.scene.children.find(c=>c.type==='Mesh') as import('three').Mesh;
    expect(mesh.geometry.index?.count).toBe(0);scene.dispose();
  });
  it('supports explicitly south-first input without mutating the source',()=>{
    const p=profile([0,1,2,10,20,30,100,110,120]);Object.assign(p.manifest.grid,{row_order:'south_to_north'});
    const d=prepareTerrain(p,undefined);expect(heightAt(d,-10,10)).toBeCloseTo(100-d.mean);
    expect(new DataView(p.buffer).getFloat32(0,true)).toBe(0);
  });
  it('rejects malformed nonempty buffers instead of silently synthesizing',()=>{
    expect(()=>prepareTerrain(profile([1,2,3]),undefined,{reliefM:50})).toThrow('buffer');
    expect(()=>prepareTerrain(null,undefined)).toThrow('catalog relief');
  });
  it('uses repeatable synthetic samples, exact requested relief and an explicit approximation label',()=>{
    const meta={id:'synthetic-site',reliefM:100,meanSlopeDeg:2,roughnessM:5,widthM:2400,depthM:4800};
    const a=prepareTerrain(null,undefined,meta),b=prepareTerrain(null,undefined,meta);
    expect(a.heights).toEqual(b.heights);expect(a.relief).toBeCloseTo(100);expect(a.synthetic).toBe(true);
    expect(a.width).toBe(2400);expect(a.note).toContain('Fit is approximate');
    expect(prepareTerrain(null,undefined,{...meta,id:'different'}).heights).not.toEqual(a.heights);
    expect(slopeGrid(new Float32Array(9),3,3,10,10)).toEqual(new Float32Array(9));
  });
  it('renders two accessible metadata panels and honest synthetic and hazard labels without WebGL',()=>{
    const html=renderToStaticMarkup(<TerrainComparison3D earthProfile={profile([0,1,2,3,4,5,6,7,8])} targetMetadata={{name:'Synthetic Moon',reliefM:80,body:'moon',latitude:-89}}/>);
    for(const text of ['Earth Analog Landing Zone','Target Moon/Mars Landing Zone','Synthesized from catalog DEM stats','5.0° elevation','no exaggeration','Data and resolution limits','not measured acquisition conditions'])expect(html).toContain(text);
  });
});
