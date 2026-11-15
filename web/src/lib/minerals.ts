/**
 * Mineral and iron-oxide abundance over a Moon or Mars study area (web/public/minerals/, written by
 * scripts/catalog/minerals.py). Measured from orbit: Kaguya Multiband Imager maps for the Moon (a real
 * map of the site, about 59 m pixels) and TES maps for Mars (one regional value: a TES pixel is larger
 * than the site). Earth sites have none. Nothing here is modelled; a missing value stays missing.
 */
export interface MineralLayer {
  key: string; name: string; unit: string; min: number; max: number; mean: number;
  /** North-first, west-first; null where the source has no data. One value for a regional record. */
  values: (number | null)[];
  /** Mars only: under the method's detection limit. */
  below_detection?: boolean;
}
export interface MineralMap {
  id: string; body: 'moon' | 'mars'; kind: 'map' | 'regional';
  grid: { rows: number; columns: number }; extent_m: { width: number; depth: number };
  source: { dataset: string; citation: string; page: string; native_resolution_m: number; retrieved: string; files?: string[] };
  /** Moon maps: share of the area the instrument observed; the rest is blank, never filled in. */
  measured_share?: number;
  layers: MineralLayer[]; caveats: string[];
}
/** What the debrief knows about a site's minerals: the record, or why there is none. */
export interface MineralState { map: MineralMap | null; reason: string }
interface MineralIndex { sites: Record<string, string>; unavailable: Record<string, string> }

export const NO_EARTH_MINERALS = 'No mineral map is ingested for Earth sites.';
let index: Promise<MineralIndex> | null = null;

export async function loadMinerals(id: string, signal?: AbortSignal): Promise<MineralState> {
  try {
    index ??= fetch('/minerals/index.json').then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<MineralIndex>; });
    const listed = await index;
    if (!(id in listed.sites)) return { map: null, reason: listed.unavailable[id] ?? 'No mineral data is ingested for this site.' };
    const response = await fetch(`/minerals/${encodeURIComponent(id)}.json`, { signal });
    if (!response.ok) throw new Error(String(response.status));
    const map = await response.json() as MineralMap;
    if (map.id !== id || !map.layers?.length) throw new Error('mismatch');
    return { map, reason: '' };
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) index = null;   // retry the index next time
    return { map: null, reason: 'The mineral data could not be loaded.' };
  }
}

/**
 * A layer's value at a point, metres east and north of the study area's centre. Nearest cell: the
 * source pixels are area averages, so no finer detail is implied. Null outside the area or where the
 * source has no data. A regional record returns its one value everywhere inside the area.
 */
export function sampleMineral(map: MineralMap, layer: MineralLayer, x: number, north: number): number | null {
  const { width, depth } = map.extent_m, { rows, columns } = map.grid;
  if (!Number.isFinite(x + north) || Math.abs(x) > width / 2 + 1e-6 || Math.abs(north) > depth / 2 + 1e-6) return null;
  const column = Math.min(columns - 1, Math.max(0, Math.floor((x / width + .5) * columns)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((.5 - north / depth) * rows)));
  const value = layer.values[row * columns + column];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The colour scale's ends for a layer: the site's own range for a map; a fixed 0 to 30% for one regional value. */
export function mineralRange(map: MineralMap, layer: MineralLayer): [number, number] {
  if (map.kind === 'regional' || layer.max - layer.min < 1e-9) return [0, Math.max(30, layer.max)];
  return [layer.min, layer.max];
}

/** Dark blue (least) through teal and green to yellow (most): readable in order by lightness alone. */
const RAMP: [number, number, number][] = [[.106, .122, .231], [.231, .322, .545], [.129, .569, .549], [.369, .788, .384], [.992, .906, .145]];
export const RAMP_CSS = `linear-gradient(90deg, ${RAMP.map(([r, g, b]) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`).join(', ')})`;
export function mineralColour(value: number, [low, high]: [number, number]): [number, number, number] {
  const t = Math.min(1, Math.max(0, (value - low) / Math.max(high - low, 1e-9))) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i, a = RAMP[i], b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export const formatMineral = (value: number, unit: string) => `${value.toFixed(value < 10 ? 1 : 0)}${unit === '%' ? '%' : ` ${unit}`}`;
