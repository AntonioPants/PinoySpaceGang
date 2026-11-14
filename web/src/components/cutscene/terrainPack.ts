/** Real terrain from the team's terrain packs (web/public/terrain/<id>/, see its README). */

export interface TerrainPack {
  manifest: {
    id: string;
    name: string;
    attribution: string;
    source: { dataset: string };
    grid: { rows: number; columns: number; spacing_m: number };
  };
  /** Absolute elevation in metres, row-major, rows run north to south. */
  heights: Float32Array;
  /** Local metres (+X east, +Z south, origin NW corner) -> height above the pack's offset, or null outside. */
  heightAt(x: number, z: number): number | null;
}

export const DEFAULT_TERRAIN_URL = "/terrain/kilbourne-hole-v1/";

/** Loads a pack with the loader that ships inside it, so there is one source of truth. Browser only. */
export async function loadTerrainPack(baseUrl = DEFAULT_TERRAIN_URL, signal?: AbortSignal): Promise<TerrainPack> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  // Only the Kilbourne pack ships a loader module; its loader reads any pack's manifest and grid.
  const mod = await import(/* @vite-ignore */ /* webpackIgnore: true */ `${base}load-terrain.mjs`)
    .catch(() => import(/* @vite-ignore */ /* webpackIgnore: true */ `${DEFAULT_TERRAIN_URL}load-terrain.mjs`));
  return mod.loadTerrain(base, { signal }) as Promise<TerrainPack>;
}

/**
 * Flat spot for the landing pad, in local pack metres: the cell nearest the middle of the pack that
 * is in the lowest quarter of the elevations and has under 2 degrees of slope over 5 x 5 cells.
 * For a crater or maar this lands on the floor. Falls back to the flattest cell, then the centre.
 */
export function pickLanding(pack: TerrainPack): { x: number; z: number } {
  const { rows, columns, spacing_m: s } = pack.manifest.grid, h = pack.heights;
  const slope = new Float32Array(rows * columns);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const at = (rr: number, cc: number) => h[Math.min(rows - 1, Math.max(0, rr)) * columns + Math.min(columns - 1, Math.max(0, cc))];
    const dx = (at(r, c + 1) - at(r, c - 1)) / (2 * s), dz = (at(r + 1, c) - at(r - 1, c)) / (2 * s);
    slope[r * columns + c] = Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
  }
  const local = (r: number, c: number) => {
    let m = 0;
    for (let rr = Math.max(0, r - 2); rr <= Math.min(rows - 1, r + 2); rr++)
      for (let cc = Math.max(0, c - 2); cc <= Math.min(columns - 1, c + 2); cc++) m = Math.max(m, slope[rr * columns + cc]);
    return m;
  };
  const sorted = Float32Array.from(h).sort();
  const lowQuarter = sorted[Math.floor(sorted.length / 4)];
  const cr = (rows - 1) / 2, cc0 = (columns - 1) / 2;
  let best = { r: Math.round(cr), c: Math.round(cc0), d: Infinity }, flattest = { r: best.r, c: best.c, m: Infinity };
  for (let r = 3; r < rows - 3; r++) for (let c = 3; c < columns - 3; c++) {
    const m = local(r, c);
    if (m < flattest.m) flattest = { r, c, m };
    if (m < 2 && h[r * columns + c] <= lowQuarter) {
      const d = Math.hypot(r - cr, c - cc0);
      if (d < best.d) best = { r, c, d };
    }
  }
  const pick = Number.isFinite(best.d) ? best : flattest.m < Infinity ? flattest : best;
  return { x: pick.c * s, z: pick.r * s };
}

/** Middle of the pack: the sim's default landing target (0, 0). */
export function packCentre(pack: TerrainPack): { x: number; z: number } {
  const { rows, columns, spacing_m: s } = pack.manifest.grid;
  return { x: ((columns - 1) * s) / 2, z: ((rows - 1) * s) / 2 };
}

/** Sim coordinates (x east, y north, origin at the pack centre) -> pack metres (x east, z south, origin NW). */
export function simToPack(pack: TerrainPack, p: { x: number; y: number }): { x: number; z: number } {
  const c = packCentre(pack);
  return { x: c.x + p.x, z: c.z - p.y };
}
