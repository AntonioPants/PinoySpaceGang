/**
 * Click anywhere: ask the matching service (supabase/functions/match-analog) to rank Earth sites
 * for any point on the Moon or Mars, and turn its answer into what the game already uses: a
 * planetary target, a terrain profile and an ordered list of Earth sites.
 *
 * A pinned point is a weaker class of evidence than a curated pairing: scored on demand from the
 * global elevation mosaic, landform from an unreviewed translation of the geologic map unit (or
 * unmapped), not reviewed, not validated. The wording here says so; do not soften it.
 * No Supabase SDK: one fetch with the public anon key.
 */
import { extractProfile } from './mission';
import { LANDFORM_RELATION } from './matching';
import type { Catalog } from './catalog';
import type { AnalogSite, Body, PlanetarySite, TerrainManifest, TerrainProfile } from './types';

export interface ClickLandform { earth_family: string | null; planetary_family: string | null; relation: 'same_family' | 'related_family' | 'different_family' | 'unknown'; match_percent: number; status: string }
export interface ClickMatch { earth_id: string; analog_score_percent: number; terrain_similarity_percent: number; landform: ClickLandform }
export interface ClickResponse {
  method: { analog_score: string; descriptors: string; click: string };
  point: { body: Body; lat: number; lon: number; name: string | null; name_source: string | null };
  comparison_resolution_m: number;
  /** Side of the scored window around the snapped point, metres. */
  window_m?: number;
  landform: { family: string | null; status: 'geologic_map_unit_unreviewed' | 'gazetteer_feature_unreviewed' | 'unknown'; unit: string | null; unit_name: string | null; source: string | null };
  ranking_basis: 'landform_and_terrain' | 'terrain_only';
  matches: ClickMatch[];
  excluded_earth_sites: number;
  terrain: { manifest: TerrainManifest; elevation_base64: string };
  provenance: { evidence_status: 'on_demand_unreviewed'; scientifically_validated: false; terrain_range_percent: null; window_sensitivity: 'not_computed'; dem: { product: string; url: string }; cached: boolean };
}
/** A scored pin: the server's answer and the planetary terrain it read, ready for the debrief's comparison flights. */
export interface ClickResult { response: ClickResponse; profile: TerrainProfile }

export type ClickErrorCode = 'unavailable' | 'bad_request' | 'out_of_range' | 'no_data' | 'upstream_unreachable';
export const SERVICE_UNAVAILABLE = 'Matching service unavailable. Choose a marked region.';
/** `message` is a sentence the player can read. `unavailable` covers missing keys, network failure and timeouts. */
export class ClickError extends Error {
  code: ClickErrorCode;
  constructor(code: ClickErrorCode, message: string) { super(message); this.name = 'ClickError'; this.code = code; }
}

const GRAVITY: Record<Body, number> = { Moon: 1.62, Mars: 3.72 };
export const CUSTOM_PREFIX = 'custom-';
export const isCustomTarget = (id: string) => id.startsWith(CUSTOM_PREFIX);
export const snap = (value: number) => Math.round(value * 100) / 100;
export const formatPoint = (lat: number, lon: number) => `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`;

function endpoint(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined, key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key && /^https:\/\//.test(url) ? { url: `${url.replace(/\/$/, '')}/functions/v1/match-analog`, key } : null;
}
export const clickConfigured = () => endpoint() !== null;

/** Check a response and decode its terrain. Throws ClickError('unavailable') on anything unexpected: no partial results. */
export function decodeClick(raw: unknown): ClickResult {
  const response = raw as ClickResponse;
  const bad = () => new ClickError('unavailable', SERVICE_UNAVAILABLE);
  if (!response || typeof response !== 'object' || !response.point || (response.point.body !== 'Moon' && response.point.body !== 'Mars') ||
      !Number.isFinite(response.point.lat) || !Number.isFinite(response.point.lon) || !Array.isArray(response.matches) ||
      !response.terrain?.manifest || typeof response.terrain.elevation_base64 !== 'string' ||
      (response.ranking_basis !== 'landform_and_terrain' && response.ranking_basis !== 'terrain_only') ||
      response.provenance?.scientifically_validated !== false) throw bad();
  for (const row of response.matches) {
    if (typeof row?.earth_id !== 'string' || !Number.isFinite(row.analog_score_percent) || !Number.isFinite(row.terrain_similarity_percent) || !row.landform) throw bad();
  }
  if (!isCustomTarget(response.terrain.manifest.id) || response.terrain.manifest.body?.toLowerCase() !== response.point.body.toLowerCase()) throw bad();
  let profile: TerrainProfile;
  try {
    const text = atob(response.terrain.elevation_base64), bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    profile = extractProfile(response.terrain.manifest, bytes.buffer);
  } catch { throw bad(); }
  return { response, profile };
}

export interface ClickOptions { signal?: AbortSignal; fetch?: typeof fetch; timeoutMs?: number; retries?: number; endpoint?: { url: string; key: string } | null }

/**
 * Score a point. One retry on a network failure, a timeout or a 5xx; a 4xx is the service's
 * final answer (for example a point too near a pole) and carries its own sentence.
 */
export async function analyseClick(body: Body, lat: number, lon: number, options: ClickOptions = {}): Promise<ClickResult> {
  const target = options.endpoint === undefined ? endpoint() : options.endpoint;
  if (!target) throw new ClickError('unavailable', SERVICE_UNAVAILABLE);
  const doFetch = options.fetch ?? fetch, attempts = 1 + (options.retries ?? 1);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const abort = new AbortController(), forward = () => abort.abort();
    options.signal?.addEventListener('abort', forward);
    const timer = setTimeout(() => abort.abort(), options.timeoutMs ?? 20000);
    try {
      const response = await doFetch(target.url, { method: 'POST', signal: abort.signal,
        headers: { apikey: target.key, Authorization: `Bearer ${target.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, lat, lon }) });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok) return decodeClick(data);
      const error = data as { code?: string; message?: string } | null;
      if (response.status < 500 && error && typeof error.message === 'string' && ['bad_request', 'out_of_range', 'no_data'].includes(error.code ?? ''))
        throw new ClickError(error.code as ClickErrorCode, error.message);
      // 401/403/404 (wrong key, function missing) and 5xx: the service is not usable.
      if (response.status < 500) throw new ClickError('unavailable', SERVICE_UNAVAILABLE);
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (error instanceof ClickError) throw error;
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', forward); }
  }
  throw new ClickError('unavailable', SERVICE_UNAVAILABLE);
}

const DEM: Record<Body, string> = { Moon: 'LOLA', Mars: 'MOLA' };
/** How the landform of a pinned point was derived, in one honest clause. */
export function landformNote(response: ClickResponse): string {
  const { landform } = response;
  if (landform.family && landform.status === 'geologic_map_unit_unreviewed')
    return `landform "${landform.family}" from geologic map unit ${landform.unit}${landform.unit_name ? ` (${landform.unit_name})` : ''}, an unreviewed translation counted at 75%${landform.family === 'crater' ? '; a geologic crater unit includes ejecta and floor' : ''}`;
  if (landform.family) return `landform "${landform.family}" from a named feature, unreviewed`;
  return landform.unit ? `landform unmapped (geologic map unit ${landform.unit}${landform.unit_name ? `, ${landform.unit_name}` : ''}, has no clear landform family)` : 'landform unmapped';
}

/** The synthetic planetary target for a scored pin. Its id starts with `custom-`; it is not in the catalog. */
export function customTarget(response: ClickResponse): PlanetarySite {
  const { point } = response, window = ((response.window_m ?? 4000) / 1000).toFixed(0);
  return {
    id: response.terrain.manifest.id, name: point.name ?? 'Custom site', body: point.body, region: formatPoint(point.lat, point.lon),
    lat: point.lat, lon: point.lon, gravity: GRAVITY[point.body],
    description: `Your pin, snapped to ${formatPoint(point.lat, point.lon)}. A ${window} km window scored on demand from the global ${DEM[point.body]} elevation mosaic at ${response.comparison_resolution_m} m; ${landformNote(response)}. Not reviewed, not validated: weaker evidence than a marked region.`,
    interests: response.landform.family ? [response.landform.family] : [], source: response.provenance.dem.url,
  };
}

/** Earth sites for a scored pin: the server's order, sites with a terrain pack only. */
export function customAnalogs(catalog: Catalog, response: ClickResponse): AnalogSite[] {
  const byId = new Map(catalog.analogs.map(site => [site.id, site]));
  return response.matches.flatMap(row => { const site = byId.get(row.earth_id); return site?.available ? [site] : []; });
}
export const clickMatch = (response: ClickResponse, earthId: string) => response.matches.find(row => row.earth_id === earthId);

/**
 * The score line for one Earth site. A terrain-only ranking shows the terrain figure and says the
 * landform is unmapped: its analog score tops out at 50 by construction and must never read as a low match.
 */
export function clickScoreLabel(response: ClickResponse, earthId: string): string {
  const row = clickMatch(response, earthId);
  if (!row) return 'Not scored for this pin';
  return response.ranking_basis === 'terrain_only'
    ? `${row.terrain_similarity_percent.toFixed(1)}% terrain match · landform unmapped`
    : `${row.analog_score_percent.toFixed(1)}% analog match`;
}
const STATUS: Record<string, string> = {
  geologic_map_unit_unreviewed: 'map unit, unreviewed', gazetteer_feature_unreviewed: 'named feature, unreviewed',
  inferred_from_scan_region_unreviewed: 'inferred, unreviewed', interpretation_only: 'catalog label',
};
/** The landform half of one row, with where its labels came from. Null for a terrain-only ranking. */
export function clickLandformLabel(response: ClickResponse, earthId: string): string | null {
  const row = clickMatch(response, earthId);
  if (!row || response.ranking_basis === 'terrain_only') return null;
  return `${LANDFORM_RELATION[row.landform.relation] ?? 'Landform type unknown'}${row.landform.relation === 'unknown' ? '' : ` (${STATUS[row.landform.status] ?? 'unreviewed'})`} · terrain ${row.terrain_similarity_percent.toFixed(1)}%`;
}

/** What every screen must say about a pinned point's ranking. */
export function clickEvidence(response: ClickResponse): { basis: string; limits: string[] } {
  const body = response.point.body, window = ((response.window_m ?? 4000) / 1000).toFixed(0);
  return {
    basis: `On-demand ranking for a ${window} km window around your pin, scored from the global ${DEM[body]} elevation mosaic at ${response.comparison_resolution_m} m; ${landformNote(response)}.`,
    limits: [
      'Not reviewed and not validated: engineering similarity, weaker evidence than a marked region.',
      `It describes the ${window} km window at the snapped point, not the whole feature seen from orbit.`,
      'A marked region\'s published list also applies screening and verification; this list does not, so the two can differ for nearby points.',
      `${body} scores use ${body === 'Moon' ? '15 terrain features at 150 m' : '12 terrain features at 500 m'} and cannot be compared with ${body === 'Moon' ? 'Mars' : 'Moon'} scores.`,
      ...(response.excluded_earth_sites ? [`${response.excluded_earth_sites} Earth site${response.excluded_earth_sites === 1 ? ' was' : 's were'} left out for missing terrain features, not scored as zero.`] : []),
    ],
  };
}
