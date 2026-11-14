/**
 * Adapters from the data team's terrain formats to SiteTerrain.
 *
 *  - profileToSite():     JSON documents from scripts/extract_profile.py
 *                         (validated by data/terrain_profile.schema.json)
 *  - terrainPackToSite(): browser terrain packs in web/public/terrain/<id>/
 *                         (manifest.json + little-endian float32 elevation grid)
 *
 * Both formats store rows north → south; SiteTerrain rows run south → north (y = north), so rows
 * are flipped. The grid is centred on (0, 0), so the default landing target is the middle of the map.
 */
import type { Body, SiteTerrain } from './types.ts';

type AnalogOf = Exclude<Body, 'earth'>;

export interface TerrainProfile {
  site: { id: string; name: string; type: 'earth_analog' | 'planetary_site'; body: Body };
  spatial: { width: number; height: number; resolution_m: { x: number; y: number } };
  terrain: { elevation_m: Array<Array<number | null>> };
}

export function profileToSite(profile: TerrainProfile, opts: { analogOf?: AnalogOf } = {}): SiteTerrain {
  const grid = profile?.terrain?.elevation_m;
  if (!Array.isArray(grid) || grid.length < 2) throw new Error('profile.terrain.elevation_m must be a 2D grid');
  const rows = grid.length;
  const cols = grid[0].length;
  if (grid.some((r) => r.length !== cols)) throw new Error('profile.terrain.elevation_m rows have different lengths');
  const { x, y } = profile.spatial.resolution_m;
  if (!(x > 0 && y > 0)) throw new Error('profile.spatial.resolution_m must be positive');

  const valid = grid.flat().filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length) throw new Error('profile has no valid elevation cells');
  const fill = valid.reduce((s, v) => s + v, 0) / valid.length; // nodata → mean elevation

  const heights = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const src = grid[rows - 1 - r];
    for (let c = 0; c < cols; c++) {
      const v = src[c];
      heights[r * cols + c] = typeof v === 'number' && Number.isFinite(v) ? v : fill;
    }
  }
  const body = profile.site.body;
  return {
    id: profile.site.id,
    name: profile.site.name,
    body,
    analogOf: body === 'earth' ? opts.analogOf : undefined,
    heightmap: { cols, rows, cellSize: (x + y) / 2, heights },
  };
}

export interface TerrainPackManifest {
  schema_version: number;
  id: string;
  name: string;
  body: string;
  grid: { rows: number; columns: number; spacing_m: number; dtype: string; byte_order: string };
}

export function terrainPackToSite(
  manifest: TerrainPackManifest,
  buffer: ArrayBufferLike,
  opts: { analogOf?: AnalogOf } = {},
): SiteTerrain {
  const { rows, columns: cols, spacing_m, dtype, byte_order } = manifest.grid;
  if (dtype !== 'float32' || byte_order !== 'little-endian') throw new Error(`unsupported grid ${dtype}/${byte_order}`);
  if (buffer.byteLength !== rows * cols * 4)
    throw new Error(`elevation file has ${buffer.byteLength} bytes, expected ${rows * cols * 4}`);
  const view = new DataView(buffer);
  const heights = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const srcRow = rows - 1 - r;
    for (let c = 0; c < cols; c++) {
      const v = view.getFloat32((srcRow * cols + c) * 4, true);
      if (!Number.isFinite(v)) throw new Error(`invalid elevation at row ${srcRow}, col ${c}`);
      heights[r * cols + c] = v;
    }
  }
  const body = manifest.body.toLowerCase() as Body;
  if (!['earth', 'moon', 'mars'].includes(body)) throw new Error(`unknown body ${manifest.body}`);
  return {
    id: manifest.id,
    name: manifest.name,
    body,
    analogOf: body === 'earth' ? opts.analogOf : undefined,
    heightmap: { cols, rows, cellSize: spacing_m, heights },
  };
}
