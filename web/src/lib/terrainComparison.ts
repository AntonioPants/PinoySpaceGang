import type { TerrainProfile } from './types';
import type { TerrainPack } from '../components/cutscene/terrainPack';

/** Absolute, bilinear DEM sample in centre-origin east/north metres. Never extrapolates. */
export function sampleTerrain(pack: TerrainPack, x: number, north: number): number | null {
  const { rows, columns, spacing_m: spacing } = pack.manifest.grid;
  const c = x / spacing + (columns - 1) / 2, r = -north / spacing + (rows - 1) / 2;
  if (!Number.isFinite(c + r) || c < 0 || r < 0 || c > columns - 1 || r > rows - 1) return null;
  const c0 = Math.min(columns - 2, Math.floor(c)), r0 = Math.min(rows - 2, Math.floor(r));
  const u = c - c0, v = r - r0, i = r0 * columns + c0, h = pack.heights;
  const height = (h[i] * (1-u) + h[i+1] * u) * (1-v) + (h[i+columns] * (1-u) + h[i+columns+1] * u) * v;
  return Number.isFinite(height) ? height : null;
}

export function comparisonBounds(earth: TerrainPack, planetary: TerrainPack) {
  const half = (p: TerrainPack, axis: 'rows' | 'columns') => (p.manifest.grid[axis] - 1) * p.manifest.grid.spacing_m / 2;
  return { halfWidth: Math.min(half(earth, 'columns'), half(planetary, 'columns')),
    halfDepth: Math.min(half(earth, 'rows'), half(planetary, 'rows')) };
}

/** Centres and centre elevations coincide; east/north and all metre scales stay unchanged. */
export function comparisonHeight(planetary: TerrainPack, earth: TerrainPack, x: number, north: number): number | null {
  if (sampleTerrain(earth, x, north) === null) return null;
  const h = sampleTerrain(planetary, x, north), centre = sampleTerrain(planetary, 0, 0), base = sampleTerrain(earth, 0, 0);
  return h === null || centre === null || base === null ? null : h - centre + base;
}

export function comparisonEarth(profile: TerrainProfile): TerrainPack {
  const data = new DataView(profile.buffer);
  const pack: TerrainPack = { manifest: profile.manifest,
    heights: Float32Array.from({length: profile.buffer.byteLength/4}, (_,i) => data.getFloat32(i*4,true)),
    heightAt: () => null };
  return pack;
}
