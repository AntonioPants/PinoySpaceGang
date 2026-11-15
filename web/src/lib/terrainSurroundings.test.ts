import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { terrainSurroundings } from './terrainSurroundings';
import { PRESETS } from '../components/cutscene/presets';

describe('continuous terrain surroundings', () => {
  it('keeps the DEM boundary exact and excludes the measured interior', () => {
    const ground = new T.PlaneGeometry(60,60,2,2);
    ground.rotateX(-Math.PI/2);
    const pos=ground.getAttribute('position') as T.BufferAttribute;
    for(let i=0;i<pos.count;i++) pos.setY(i,10+pos.getX(i)*.1);
    const original=Array.from(pos.array);
    const far=new T.Mesh(new T.PlaneGeometry(200000,200000),new T.MeshBasicMaterial({side:T.DoubleSide}));
    far.rotation.x=-Math.PI/2; far.position.y=100; far.updateMatrixWorld(true);
    const surroundings=terrainSurroundings(ground,{west:-30,east:30,north:-30,south:30},
      new T.Matrix4(),far,PRESETS.crater);
    for(let i=0;i<1000;i++) surroundings.update();
    const geometry=surroundings.mesh.geometry;
    const p=geometry.getAttribute('position'), index=geometry.index!;
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),z=p.getZ(i);
      if(Math.abs(x)<=30 && Math.abs(z)<=30) expect(p.getY(i)).toBeCloseTo(10+x*.1);
      if(Math.abs(x)===1830 && Math.abs(z)<=30) expect(p.getY(i)).toBeCloseTo(100);
    }
    for(let i=0;i<index.count;i+=3) {
      const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
      expect(ids.every(j=>Math.abs(p.getX(j))<30 && Math.abs(p.getZ(j))<30)).toBe(false);
    }
    expect(Array.from(pos.array)).toEqual(original);
    surroundings.dispose(); ground.dispose(); far.geometry.dispose(); far.material.dispose();
  });
});
