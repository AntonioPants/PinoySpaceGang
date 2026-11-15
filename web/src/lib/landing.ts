import type { TerrainProfile } from './types';

/** A landing point in the simulation's frame: x east, y north, metres from the centre of the terrain patch. */
export interface LandingPoint { x: number; y: number }
export const PATCH_CENTRE: LandingPoint = { x: 0, y: 0 };

/**
 * How far from the patch centre a landing point may be placed, east-west and north-south.
 * The descent starts 400 m west of its target and guidance may divert 120 m, so a margin
 * of 600 m (at most a quarter of the patch) keeps the whole flight over measured ground.
 */
export function landingArea(profile: TerrainProfile): { halfX: number; halfY: number } {
  const { rows, columns, spacing_m: spacing } = profile.manifest.grid;
  const reach = (count: number) => { const half = (count - 1) * spacing / 2; return Math.max(0, half - Math.min(600, half / 2)); };
  return { halfX: reach(columns), halfY: reach(rows) };
}

export function insideLandingArea(profile: TerrainProfile, point: LandingPoint): boolean {
  const { halfX, halfY } = landingArea(profile);
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= halfX && Math.abs(point.y) <= halfY;
}

/** "420 m E, 310 m N of centre", for the terrain view's readout. */
export function describeLanding(point: LandingPoint): string {
  const x = Math.round(point.x), y = Math.round(point.y);
  if (!x && !y) return 'centre of the patch';
  const parts = [x ? `${Math.abs(x).toLocaleString()} m ${x > 0 ? 'E' : 'W'}` : '', y ? `${Math.abs(y).toLocaleString()} m ${y > 0 ? 'N' : 'S'}` : ''].filter(Boolean);
  return `${parts.join(', ')} of centre`;
}
