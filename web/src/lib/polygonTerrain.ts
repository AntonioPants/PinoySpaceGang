import * as T from 'three';
import { colorize } from '../components/cutscene/terrain';

export type TerrainBounds = { west: number; east: number; north: number; south: number };

/** Independent vertices give every triangle its own normal and map colour. */
export function polygonGeometry(geometry: T.BufferGeometry) {
  if (geometry.index) {
    const expanded = geometry.toNonIndexed();
    geometry.copy(expanded);
    expanded.dispose();
  }
  geometry.computeVertexNormals();
}


/** Keep the streamed terrain's geometry, using the landing site's polygon style. */
export function polygonTilePlugin(ecefToLocal: T.Matrix4, look: import('../components/cutscene/presets').EnvLook) {
  return {
    name: 'POLYGON_TERRAIN',
    processTileModel(scene: T.Object3D) {
      scene.updateMatrixWorld(true);
      scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const mesh = object as T.Mesh<T.BufferGeometry,T.Material | T.Material[]>;
        const toLocal = ecefToLocal.clone().multiply(mesh.matrixWorld);
        const fromLocal = toLocal.clone().invert();
        polygonGeometry(mesh.geometry);
        mesh.geometry.applyMatrix4(toLocal);
        colorize(mesh.geometry,look,7);
        mesh.geometry.applyMatrix4(fromLocal);
        const original = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const materials = original.map(material => new T.MeshStandardMaterial({
          vertexColors:true, flatShading:true, roughness:1, side:material.side,
        }));
        original.forEach(material=>material.dispose());
        mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      });
    },
  };
}

/**
 * How far the streamed surface sits above the measured DEM (metres, + = above), from height
 * differences at `probes` sample points. The gap between sea-level and ellipsoid heights is
 * within about ±110 m everywhere on Earth, so larger differences are coarse, still-loading tiles
 * and are ignored; the median ignores trees and buildings. Null until at least 60 % of the
 * probes (and 5) agree.
 */
export const MAX_GEOID_GAP_M = 150;
export function streamedGap(gaps: number[], probes = gaps.length): number | null {
  const ok = gaps.filter(g => Number.isFinite(g) && Math.abs(g) <= MAX_GEOID_GAP_M).sort((a, b) => a - b);
  if (ok.length < Math.max(5, Math.ceil(probes * 0.6))) return null;
  const mid = ok.length >> 1;
  return ok.length % 2 ? ok[mid] : (ok[mid - 1] + ok[mid]) / 2;
}
