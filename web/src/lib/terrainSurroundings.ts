import * as T from 'three';
import { colorize } from '../components/cutscene/terrain';
import type { EnvLook } from '../components/cutscene/presets';
import type { TerrainBounds } from './polygonTerrain';

/** A single shared grid joins the DEM perimeter to streamed elevation samples.
 * The original DEM vertices are used verbatim at the join. */
export function terrainSurroundings(ground: T.BufferGeometry, bounds: TerrainBounds,
  localToWorld: T.Matrix4, tiles: T.Object3D, look: EnvLook) {
  const source = ground.getAttribute('position');
  const xs = new Set<number>(), zs = new Set<number>(), heights = new Map<string,number>();
  const key = (x:number,z:number) => `${x}:${z}`;
  for (let i=0;i<source.count;i++) {
    const x = source.getX(i), z = source.getZ(i);
    if (x < bounds.west || x > bounds.east || z < bounds.north || z > bounds.south) continue;
    xs.add(x); zs.add(z); heights.set(key(x,z),source.getY(i));
  }
  const originalX = [...xs].sort((a,b)=>a-b), originalZ = [...zs].sort((a,b)=>a-b);
  const rings = [120,240,480,800,1200,1800];
  const axis = (values:number[], low:number, high:number) => [
    ...rings.map(d=>low-d).reverse(), ...values, ...rings.map(d=>high+d),
  ];
  const xAxis = axis(originalX,bounds.west,bounds.east), zAxis = axis(originalZ,bounds.north,bounds.south);
  const vertices:number[] = [], indices:number[] = [];
  const pending: { index:number; x:number; z:number; edgeHeight:number; distance:number }[] = [];
  for (const z of zAxis) for (const x of xAxis) {
    const cx = T.MathUtils.clamp(x,bounds.west,bounds.east);
    const cz = T.MathUtils.clamp(z,bounds.north,bounds.south);
    const edgeHeight = heights.get(key(cx,cz)) ?? 0;
    const distance = Math.hypot(x-cx,z-cz);
    const index = vertices.length/3;
    vertices.push(x,edgeHeight,z);
    if (distance > 0) pending.push({index,x,z,edgeHeight,distance});
  }
  const columns = xAxis.length;
  for (let r=0;r<zAxis.length-1;r++) for(let c=0;c<columns-1;c++) {
    if (xAxis[c]>=bounds.west && xAxis[c+1]<=bounds.east &&
      zAxis[r]>=bounds.north && zAxis[r+1]<=bounds.south) continue;
    const a=r*columns+c,b=a+1,d=a+columns,e=d+1;
    indices.push(a,d,b,b,d,e);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);
  colorize(geometry,look,7);
  const material = new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,transparent:true,depthWrite:false})
  // Only the joining collar is resampled. Fade its outside edge over the
  // original streamed mesh, which retains all distant ridges and valleys.
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 collarPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n collarPosition = position.xz;');
    shader.fragmentShader = 'varying vec2 collarPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 outside = max(max(vec2(${bounds.west}, ${bounds.north}) - collarPosition,
        collarPosition - vec2(${bounds.east}, ${bounds.south})), vec2(0.0));
      diffuseColor.a *= 1.0 - smoothstep(800.0, 1800.0, length(outside));
    `);
  };
  material.customProgramCacheKey = () => JSON.stringify(bounds);;
  const mesh = new T.Mesh(geometry,material);
  mesh.matrixAutoUpdate=false; mesh.matrix.copy(localToWorld);
  mesh.frustumCulled=false; mesh.renderOrder=2;
  // Sample nearby rings first. A bounded batch avoids blocking the flight.
  pending.sort((a,b)=>a.distance-b.distance);
  const ray = new T.Raycaster(), point = new T.Vector3();
  const inverse = localToWorld.clone().invert();
  const down = new T.Vector3(0,-1,0).transformDirection(localToWorld);
  let cursor=0, needsRefresh=true, changed=false, revision=0, samplingRevision=0;
  function update() {
    if (!needsRefresh) return;
    if (cursor===0) samplingRevision=revision;
    const position = geometry.getAttribute('position') as T.BufferAttribute;
    const until = performance.now()+3;
    let sampled=0;
    while (cursor<pending.length && sampled<100 && performance.now()<until) {
      const sample=pending[cursor++];
      point.set(sample.x,60000,sample.z).applyMatrix4(localToWorld);
      ray.set(point,down);
      const hit=ray.intersectObject(tiles,true)[0];
      if (hit) {
        const elevation=point.copy(hit.point).applyMatrix4(inverse).y;
        const blend=T.MathUtils.smoothstep(sample.distance,0,1800);
        position.setY(sample.index,T.MathUtils.lerp(sample.edgeHeight,elevation,blend));
        changed=true;
      }
      sampled++;
    }
    if (changed) {
      position.needsUpdate=true;
      colorize(geometry,look,7);
      changed=false;
    }
    if(cursor===pending.length) { cursor=0; needsRefresh=samplingRevision!==revision; }
  }
  return {
    mesh,
    get ready(){return !needsRefresh;},
    refresh() { revision++; needsRefresh=true; },
    update,
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
