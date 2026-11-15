import * as T from 'three';
import type { TerrainPack } from '../components/cutscene/terrainPack';
import { comparisonBounds, comparisonHeight } from './terrainComparison';

/** A bounded, x-ray hologram. Render-only: never supplied to collision or guidance. */
export function buildTerrainHologram(earth: TerrainPack, planetary: TerrainPack,
  frame: { target?: { x: number; y: number }; elevation: number; curved?: boolean }) {
  const { halfWidth: w, halfDepth: d } = comparisonBounds(earth, planetary);
  const step = planetary.manifest.grid.spacing_m;
  const nx = Math.min(128, Math.max(2, Math.ceil(2*w/step))), nz = Math.min(128, Math.max(2, Math.ceil(2*d/step)));
  const vertices: number[] = [], indices: number[] = [], grid: number[] = [];
  const target = frame.target ?? { x: 0, y: 0 };
  for (let r=0; r<=nz; r++) for (let c=0; c<=nx; c++) {
    const x = -w + c/nx*2*w, z = -d + r/nz*2*d;
    const curve = frame.curved ? Math.sqrt(6_371_000**2-x*x-z*z)-6_371_000 : 0;
    vertices.push(x-target.x, comparisonHeight(planetary, earth, x, -z)!-frame.elevation+curve, z+target.y);
    const i = r*(nx+1)+c;
    if (r<nz && c<nx) indices.push(i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2);
    if (c<nx) grid.push(i,i+1);
    if (r<nz) grid.push(i,i+nx+1);
  }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3)); geometry.setIndex(indices);
  const group = new T.Group(); group.name = 'planetary-terrain-hologram';
  const surface = new T.Mesh(geometry, new T.MeshBasicMaterial({color:0x65e7ff, transparent:true, opacity:.09, side:T.DoubleSide, depthWrite:false, depthTest:false, fog:false}));
  const lines = new T.BufferGeometry(); lines.setAttribute('position',geometry.attributes.position); lines.setIndex(grid);
  const wire = new T.LineSegments(lines, new T.LineBasicMaterial({color:0x65e7ff, transparent:true, opacity:.5, depthWrite:false, depthTest:false, fog:false}));
  surface.renderOrder=8; wire.renderOrder=9; group.add(surface,wire);
  return group;
}

export function disposeHologram(group: T.Group) {
  group.removeFromParent();
  group.traverse(o => { if (o instanceof T.Mesh || o instanceof T.LineSegments) { o.geometry.dispose(); o.material.dispose(); } });
}
