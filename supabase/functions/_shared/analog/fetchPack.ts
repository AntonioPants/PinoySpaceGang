// fetchPack(body, lat, lon): a 33 x 33 north-first float32 elevation grid around any point on
// the Moon or Mars, in the same local azimuthal-equidistant frame as the Python pack builder
// (scripts/catalog/build.py), read from the public global mosaics with HTTP range requests only.
// No dependencies: global fetch, DecompressionStream and typed arrays (Deno and Node 18+).
import { MARS_TILE_COUNTS, MARS_TILE_OFFSETS } from './marsTiles.ts';

export type ClickBody = 'Moon' | 'Mars';
export type PackErrorCode = 'out_of_range' | 'no_data' | 'upstream_unreachable';
/** The only error fetchPack throws on purpose; `message` is a sentence a player can read. */
export class PackError extends Error {
  code: PackErrorCode;
  constructor(code: PackErrorCode, message: string) { super(message); this.name = 'PackError'; this.code = code; }
}

export const PACK_CELLS = 33;
const NODATA = -32768;

interface Source {
  url: string; product: string; radiusM: number; width: number; height: number;
  pixelM: number; originX: number; originY: number; scale: number; spacingM: number; maxAbsLat: number;
  verticalDatum: string; licenseUrl: string;
}
export const SOURCES: Record<ClickBody, Source> = {
  Mars: {
    url: 'https://asc-mars.s3.us-west-2.amazonaws.com/basemaps/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif',
    product: 'MGS MOLA 463 m global mosaic', radiusM: 3396190, width: 46080, height: 23040,
    pixelM: 463.0935415503709, originX: -10669675.197320545, originY: 5334837.598660273, scale: 1, spacingM: 500, maxAbsLat: 89.7,
    verticalDatum: 'MOLA areoid', licenseUrl: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m',
  },
  Moon: {
    url: 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif',
    product: 'LRO LOLA 118 m global mosaic', radiusM: 1737400, width: 92160, height: 46080,
    pixelM: 118.4505876, originX: -5458203.076608, originY: 2729101.538304, scale: 0.5, spacingM: 150, maxAbsLat: 89.9,
    verticalDatum: '1737400 m reference sphere', licenseUrl: 'https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m',
  },
};
// Moon: BigTIFF, uncompressed int16, one row per strip, strips contiguous (checked against all
// 46,080 StripOffsets on 2026-11-15): byte offset of a pixel = first + row * 184,320 + col * 2.
const MOON_FIRST_STRIP = 738233, MOON_ROW_BYTES = 184320;
const MARS_TILE = 512, MARS_TILES_ACROSS = 90;

export interface FetchOptions { fetch?: typeof fetch; signal?: AbortSignal; retries?: number; /** false: plain bilinear point sampling (for comparison only). */ widenKernel?: boolean }
export interface Pack {
  body: ClickBody; lat: number; lon: number; rows: number; columns: number; spacingM: number;
  /** North-first, west-first elevations in metres above the source's datum. */
  data: Float32Array; minM: number; maxM: number; rangeRequests: number; bytesRead: number;
  source: { product: string; url: string; verticalDatum: string; licenseUrl: string; nativeSpacingM: number };
}

/** Inverse spherical azimuthal-equidistant projection: metres east and north of (lat0, lon0) to radians. */
export function inverseAeqd(east: number, north: number, lat0: number, lon0: number, radiusM: number): { lat: number; lon: number } {
  const rho = Math.hypot(east, north);
  if (rho < 1e-9) return { lat: lat0, lon: lon0 };
  const c = rho / radiusM, sinC = Math.sin(c), cosC = Math.cos(c), sin0 = Math.sin(lat0), cos0 = Math.cos(lat0);
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, cosC * sin0 + north * sinC * cos0 / rho))),
    lon: lon0 + Math.atan2(east * sinC, rho * cos0 * cosC - north * sin0 * sinC),
  };
}

/** One cell centre in the source raster: fractional row and column (pixel-centre coordinates, column not yet wrapped). */
interface Sample { row: number; col: number }
interface Geometry { samples: Sample[]; /** Half-widths of the triangle kernel, in source pixels. */ kx: number; ky: number }
interface Tap { row: number; col: number; weight: number }

/**
 * Fractional source row and column of every cell centre. Columns wrap and rows clamp when the
 * taps are taken; no longitude/latitude bounding box is ever formed.
 * The kernel follows GDAL's bilinear resampling, which the pack builder uses: where the output
 * cell is larger than a source pixel (always in longitude near a pole) the triangle kernel is
 * widened by that ratio, so the result is an average rather than a point sample.
 */
export function sampleGeometry(body: ClickBody, latDeg: number, lonDeg: number, widen = true): Geometry {
  const s = SOURCES[body], rad = Math.PI / 180, half = (PACK_CELLS - 1) / 2, samples: Sample[] = [];
  const lon0 = lonDeg * rad, col0 = (s.radiusM * lon0 - s.originX) / s.pixelM - 0.5;
  let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
  for (let i = 0; i < PACK_CELLS; i++) for (let j = 0; j < PACK_CELLS; j++) {
    const { lat, lon } = inverseAeqd((j - half) * s.spacingM, (half - i) * s.spacingM, latDeg * rad, lon0, s.radiusM);
    // Pixel centres sit at half-integer raster coordinates. lon - lon0 lies within +-pi, so the
    // column stays continuous across the date line.
    const col = col0 + s.radiusM * (lon - lon0) / s.pixelM, row = (s.originY - s.radiusM * lat) / s.pixelM - 0.5;
    samples.push({ row, col });
    minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col); minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
  }
  // Source pixels per output cell along each raster axis, as GDAL derives it from the warp window.
  const kx = widen ? Math.max(1, (maxCol - minCol) / (PACK_CELLS - 1)) : 1, ky = widen ? Math.max(1, (maxRow - minRow) / (PACK_CELLS - 1)) : 1;
  return { samples, kx, ky };
}

/** The block of source pixels one cell centre reads: unwrapped, unclamped integer bounds. */
function footprint(sample: Sample, kx: number, ky: number) {
  return { r0: Math.floor(sample.row - ky) + 1, r1: Math.ceil(sample.row + ky) - 1, c0: Math.floor(sample.col - kx) + 1, c1: Math.ceil(sample.col + kx) - 1 };
}
const wrapCol = (c: number, width: number) => ((c % width) + width) % width;
const clampRow = (r: number, height: number) => Math.max(0, Math.min(height - 1, r));

/** Visit the source pixels one cell centre reads, with unnormalised triangle weights. Nothing is allocated per tap. */
function eachTap(body: ClickBody, sample: Sample, kx: number, ky: number, visit: (row: number, col: number, weight: number) => void) {
  const s = SOURCES[body], f = footprint(sample, kx, ky);
  for (let r = f.r0; r <= f.r1; r++) {
    const wr = 1 - Math.abs(r - sample.row) / ky; if (wr <= 0) continue;
    const row = clampRow(r, s.height);
    for (let c = f.c0; c <= f.c1; c++) {
      const wc = 1 - Math.abs(c - sample.col) / kx;
      if (wc > 0) visit(row, wrapCol(c, s.width), wr * wc);
    }
  }
}

/** The taps of one cell centre with normalised weights. kx = ky = 1 is plain bilinear. For tests and small kernels. */
export function taps(body: ClickBody, sample: Sample, kx: number, ky: number): Tap[] {
  const out: Tap[] = []; let total = 0;
  eachTap(body, sample, kx, ky, (row, col, weight) => { out.push({ row, col, weight }); total += weight; });
  for (const tap of out) tap.weight /= total;
  return out;
}

const tooPolar = (body: ClickBody) => new PackError('out_of_range', `This point is too close to the pole for the ${body === 'Moon' ? 'lunar' : 'Mars'} elevation mosaic. Choose a point further from the pole.`);

async function rangeRead(url: string, start: number, length: number, options: FetchOptions, counter: { requests: number; bytes: number }): Promise<Uint8Array> {
  const doFetch = options.fetch ?? fetch, attempts = 1 + (options.retries ?? 2);
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt) await new Promise(done => setTimeout(done, 300 * attempt));
    try {
      const response = await doFetch(url, { headers: { Range: `bytes=${start}-${start + length - 1}` }, signal: options.signal });
      if (response.status !== 206) { last = new Error(`HTTP ${response.status}`); await response.body?.cancel(); continue; }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== length) { last = new Error('short read'); continue; }
      counter.requests++; counter.bytes += length;
      return bytes;
    } catch (error) { last = error; if (options.signal?.aborted) break; }
  }
  throw new PackError('upstream_unreachable', `The elevation archive could not be reached (${last instanceof Error ? last.message : 'network error'}). Try again in a moment.`);
}

async function pool<T>(jobs: (() => Promise<T>)[], width: number): Promise<T[]> {
  const results: T[] = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, async () => { while (next < jobs.length) { const i = next++; results[i] = await jobs[i](); } }));
  return results;
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type Lookup = (row: number, col: number) => number;

/** Mars: tiled 512 x 512, deflate, horizontal predictor. Fetch and decode only the tiles touched. */
async function marsLookup(geometry: Geometry, options: FetchOptions, counter: { requests: number; bytes: number }): Promise<Lookup> {
  const s = SOURCES.Mars, needed = new Set<number>();
  for (const sample of geometry.samples) {
    const f = footprint(sample, geometry.kx, geometry.ky);
    if (f.c1 - f.c0 >= s.width) throw tooPolar('Mars');
    for (const tileRow of new Set([Math.floor(clampRow(f.r0, s.height) / MARS_TILE), Math.floor(clampRow(f.r1, s.height) / MARS_TILE)])) {
      // Step across the footprint a tile at a time, always including its last column.
      for (let c = f.c0; ; c = Math.min(c + MARS_TILE, f.c1)) { needed.add(tileRow * MARS_TILES_ACROSS + Math.floor(wrapCol(c, s.width) / MARS_TILE)); if (c === f.c1) break; }
    }
  }
  if (needed.size > 24) throw tooPolar('Mars');
  const tiles = new Map<number, Int16Array>();
  await pool([...needed].map(index => async () => {
    const raw = await inflate(await rangeRead(SOURCES.Mars.url, MARS_TILE_OFFSETS[index], MARS_TILE_COUNTS[index], options, counter));
    if (raw.length !== MARS_TILE * MARS_TILE * 2) throw new PackError('upstream_unreachable', 'The Mars elevation archive returned an unexpected tile.');
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength), tile = new Int16Array(MARS_TILE * MARS_TILE);
    // Undo the horizontal predictor: each sample is stored as the difference from its left neighbour.
    for (let r = 0; r < MARS_TILE; r++) {
      let value = 0;
      for (let c = 0; c < MARS_TILE; c++) { value = (value + view.getInt16((r * MARS_TILE + c) * 2, true)) << 16 >> 16; tile[r * MARS_TILE + c] = value; }
    }
    tiles.set(index, tile);
  }), 8);
  return (row, col) => tiles.get(Math.floor(row / MARS_TILE) * MARS_TILES_ACROSS + Math.floor(col / MARS_TILE))![(row % MARS_TILE) * MARS_TILE + col % MARS_TILE];
}

/** Moon: uncompressed rows. For each row touched, fetch only the spans of columns needed. */
async function moonLookup(geometry: Geometry, options: FetchOptions, counter: { requests: number; bytes: number }): Promise<Lookup> {
  const moon = SOURCES.Moon, byRow = new Map<number, [number, number][]>();
  for (const sample of geometry.samples) {
    const f = footprint(sample, geometry.kx, geometry.ky);
    if (f.c1 - f.c0 >= moon.width) throw tooPolar('Moon');
    // A footprint that crosses the date line becomes two intervals.
    const a = wrapCol(f.c0, moon.width), b = wrapCol(f.c1, moon.width);
    const parts: [number, number][] = a <= b ? [[a, b]] : [[a, moon.width - 1], [0, b]];
    for (let r = f.r0, previous = -1; r <= f.r1; r++) {
      const row = clampRow(r, moon.height); if (row === previous) continue; previous = row;
      let list = byRow.get(row); if (!list) byRow.set(row, list = []);
      list.push(...parts);
    }
  }
  // Intervals closer than this many pixels are read as one span.
  const GAP = 4096, spans: { row: number; from: number; to: number; data?: DataView }[] = [];
  for (const [row, list] of byRow) {
    list.sort((p, q) => p[0] - q[0]); let [from, to] = list[0];
    for (const [a, b] of list) { if (a - to > GAP) { spans.push({ row, from, to }); from = a; to = b; } else to = Math.max(to, b); }
    spans.push({ row, from, to });
  }
  const total = spans.reduce((sum, s) => sum + (s.to - s.from + 1) * 2, 0);
  if (total > 12_000_000) throw tooPolar('Moon');
  await pool(spans.map(span => async () => {
    const bytes = await rangeRead(SOURCES.Moon.url, MOON_FIRST_STRIP + span.row * MOON_ROW_BYTES + span.from * 2, (span.to - span.from + 1) * 2, options, counter);
    span.data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }), 12);
  const index = new Map<number, typeof spans>();
  for (const span of spans) { const list = index.get(span.row) ?? []; list.push(span); index.set(span.row, list); }
  return (row, col) => { const span = index.get(row)!.find(s => col >= s.from && col <= s.to)!; return span.data!.getInt16((col - span.from) * 2, true); };
}

/**
 * Read the 33 x 33 pack around a point. Throws PackError:
 * `out_of_range` (bad coordinates or too close to a pole), `no_data` (the mosaic has a gap in
 * the window; never filled), `upstream_unreachable` (the archive did not answer).
 */
export async function fetchPack(body: ClickBody, lat: number, lon: number, options: FetchOptions = {}): Promise<Pack> {
  const source = SOURCES[body];
  if (!source) throw new PackError('out_of_range', 'Only the Moon and Mars can be analysed.');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 360) throw new PackError('out_of_range', 'Latitude must be within -90 to 90 and longitude within -180 to 180.');
  if (Math.abs(lat) > source.maxAbsLat) throw new PackError('out_of_range', `Points within ${(90 - source.maxAbsLat).toFixed(1)} degrees of a pole cannot be analysed: the elevation mosaic is unreliable there.`);
  const geometry = sampleGeometry(body, lat, lon, options.widenKernel !== false), counter = { requests: 0, bytes: 0 };
  const lookup = await (body === 'Mars' ? marsLookup : moonLookup)(geometry, options, counter);
  const data = new Float32Array(geometry.samples.length); let min = Infinity, max = -Infinity;
  const tally = { sum: 0, total: 0, missing: false };
  const visit = (row: number, col: number, weight: number) => {
    const raw = lookup(row, col);
    if (raw === NODATA) tally.missing = true;
    tally.sum += raw * weight; tally.total += weight;
  };
  for (let k = 0; k < data.length; k++) {
    tally.sum = 0; tally.total = 0;
    eachTap(body, geometry.samples[k], geometry.kx, geometry.ky, visit);
    // Missing data is an error, never filled.
    if (tally.missing) throw new PackError('no_data', `The elevation mosaic has no data for part of this ${(PACK_CELLS * source.spacingM / 1000).toFixed(0)} km window, so it cannot be scored. Choose another point.`);
    const value = tally.sum / tally.total * source.scale;
    data[k] = value; if (value < min) min = value; if (value > max) max = value;
  }
  return { body, lat, lon, rows: PACK_CELLS, columns: PACK_CELLS, spacingM: source.spacingM, data, minM: min, maxM: max,
    rangeRequests: counter.requests, bytesRead: counter.bytes,
    source: { product: source.product, url: source.url, verticalDatum: source.verticalDatum, licenseUrl: source.licenseUrl, nativeSpacingM: source.pixelM } };
}

/** A terrain-pack manifest for a fetched grid, in the shape web/src/lib/mission.ts extractProfile accepts. */
export function packManifest(pack: Pack, id: string, name: string) {
  const half = (pack.columns * pack.spacingM) / 2;
  return {
    schema_version: 1, id, name, body: pack.body.toLowerCase(),
    grid: { rows: pack.rows, columns: pack.columns, spacing_m: pack.spacingM, width_m: (pack.columns - 1) * pack.spacingM, depth_m: (pack.rows - 1) * pack.spacingM,
      dtype: 'float32', byte_order: 'little-endian', sample_file: 'inline', order: 'north-first, west-first',
      projection: `+proj=aeqd +lat_0=${pack.lat} +lon_0=${pack.lon} +R=${SOURCES[pack.body].radiusM} +units=m`,
      affine: [pack.spacingM, 0, -half, 0, -pack.spacingM, half] },
    local_frame: { vertical_offset_m: Math.floor(pack.minM) },
    source: { url: pack.source.url, dataset: pack.source.product, native_spacing_m_approx: Math.round(pack.source.nativeSpacingM * 10) / 10, vertical_datum: pack.source.verticalDatum },
    limitations: [
      'Read on demand from the global mosaic by bilinear sampling; not reviewed and not a curated study area.',
      'Regional surface only; no caves, wheel-scale hazards, or landing safety certification.',
      'Native sampling varies with latitude; output spacing is not source resolving power.'],
    attribution: 'NASA MGS MOLA / LRO LOLA Science Teams; USGS Astrogeology mosaic distribution',
    license_url: pack.source.licenseUrl,
  };
}

/** Base64 of the grid as float32 little-endian, north-first (the wire format of the edge function). */
export function packBase64(pack: Pack): string {
  const bytes = new Uint8Array(pack.data.length * 4), view = new DataView(bytes.buffer);
  pack.data.forEach((value, i) => view.setFloat32(i * 4, value, true));
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
