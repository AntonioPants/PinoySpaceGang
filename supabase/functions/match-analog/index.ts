// match-analog: rank Earth analog sites for any point on the Moon or Mars.
//
// POST { body: "Moon" | "Mars", lat, lon } -> the 33 x 33 terrain window around the point (read on
// demand from the USGS global elevation mosaic), its landform from the USGS global geologic map
// (unreviewed, discounted) and place name from the IAU gazetteer, and every Earth site scored
// with the published analog score. See supabase/README.md and docs/ANALOG_MATCHING.md.
//
// The scoring and the readers are the shared modules the parity tests exercise. Reference data
// (Earth vectors, the Mars tile table, the unit-to-family table) lives in the `analog_assets`
// table, loaded from the files beside the shared modules by scripts/supabase/load_reference.py.
import { fetchPack, packBase64, packManifest, PackError, SOURCES, type ClickBody, type MarsTiles } from '../_shared/analog/fetchPack.ts';
import { DESCRIPTOR_VERSION, packFeatures } from '../_shared/analog/describe.ts';
import { ANALOG_SCORE_VERSION, rank, RESOLUTION_M, type EarthVectors } from '../_shared/analog/score.ts';
import { INFERRED_FACTOR } from '../_shared/analog/landform.ts';

/** Bump when anything that changes a response changes, so older cache rows are not served. */
const CLICK_VERSION = '1.1.0';
const METHOD = { analog_score: ANALOG_SCORE_VERSION, descriptors: DESCRIPTOR_VERSION, click: CLICK_VERSION };
const METHOD_KEY = `${METHOD.analog_score}/${METHOD.descriptors}/${METHOD.click}`;
/** The scored window: the central 4 km of the pack. */
const WINDOW_M = 4000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (status: number, code: 'bad_request' | 'out_of_range' | 'no_data' | 'upstream_unreachable', message: string) => json(status, { code, message });

// deno-lint-ignore no-explicit-any
const env = (name: string): string | undefined => (globalThis as any).Deno?.env.get(name);
const DB = env('SUPABASE_URL');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY') ?? (() => { try { return JSON.parse(env('SUPABASE_SECRET_KEYS') ?? '{}').default as string | undefined; } catch { return undefined; } })();
const rest = (path: string, init: RequestInit = {}) => fetch(`${DB}/rest/v1/${path}`, {
  ...init, headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
});

interface UnitFamilies { [body: string]: { source: string; units: Record<string, { unit_name?: string; family: string | null; why?: string }> } }
interface Assets { earth: EarthVectors; marsTiles: MarsTiles; families: UnitFamilies | null }
let assets: Promise<Assets> | null = null;
function loadAssets(): Promise<Assets> {
  assets ??= (async () => {
    const response = await rest('analog_assets?select=name,content&name=in.(earth-vectors,mars-tiles,unit-families)');
    if (!response.ok) throw new Error(`reference data: HTTP ${response.status}`);
    const rows = await response.json() as { name: string; content: unknown }[], get = (name: string) => rows.find(row => row.name === name)?.content;
    const earth = get('earth-vectors') as EarthVectors | undefined, marsTiles = get('mars-tiles') as MarsTiles | undefined;
    if (!earth?.sites || !marsTiles?.offsets) throw new Error('reference data is not loaded');
    return { earth, marsTiles, families: (get('unit-families') as UnitFamilies | undefined) ?? null };
  })().catch(error => { assets = null; throw error; });
  return assets;
}

interface Context { unit: { unit: string; unit_name: string | null } | null; feature: { name: string; feature_type: string | null; lat: number; lon: number; diameter_km: number; distance_km: number; inside: boolean } | null }
/** What the geologic map and the gazetteer say about the point. Null when the lookup is not available. */
async function context(body: ClickBody, lat: number, lon: number): Promise<Context | null> {
  try {
    const response = await rest('rpc/click_context', { method: 'POST', body: JSON.stringify({ p_body: body, p_lat: lat, p_lon: lon }) });
    return response.ok ? await response.json() as Context : null;
  } catch { return null; }
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** "Inside Jezero" or "42 km north-east of Jezero". */
function placeName(feature: Context['feature'], lat: number, lon: number): string | null {
  if (!feature) return null;
  if (feature.inside) return `Inside ${feature.name}`;
  const rad = Math.PI / 180, dLon = (lon - feature.lon) * rad;
  const y = Math.sin(dLon) * Math.cos(lat * rad), x = Math.cos(feature.lat * rad) * Math.sin(lat * rad) - Math.sin(feature.lat * rad) * Math.cos(lat * rad) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) / rad + 360) % 360;
  return `${Math.max(1, Math.round(feature.distance_km))} km ${COMPASS[Math.round(bearing / 45) % 8]} of ${feature.name}`;
}

const tag = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(2)}${value < 0 ? negative : positive}`;

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return fail(405, 'bad_request', 'Send a POST request with a body, a latitude and a longitude.');
  let input: { body?: unknown; lat?: unknown; lon?: unknown };
  try { input = await request.json(); } catch { return fail(400, 'bad_request', 'The request was not valid JSON.'); }
  const body = input?.body;
  if (body !== 'Moon' && body !== 'Mars') return fail(400, 'bad_request', 'Choose a point on the Moon or on Mars.');
  if (typeof input.lat !== 'number' || typeof input.lon !== 'number' || !Number.isFinite(input.lat) || !Number.isFinite(input.lon)) return fail(400, 'bad_request', 'Latitude and longitude must be numbers.');
  if (Math.abs(input.lat) > 90 || Math.abs(input.lon) > 360) return fail(422, 'out_of_range', 'Latitude must be within -90 to 90 and longitude within -180 to 180.');
  // Everything below uses the point snapped to 0.01 degrees.
  const lat = Math.round(input.lat * 100) / 100;
  let lon = Math.round(((((input.lon + 180) % 360) + 360) % 360 - 180) * 100) / 100;
  if (lon >= 180) lon = -180;

  const cacheQuery = `analog_click_cache?select=response&body=eq.${body}&lat_q=eq.${lat}&lon_q=eq.${lon}&method_version=eq.${encodeURIComponent(METHOD_KEY)}`;
  try {
    const cached = await rest(cacheQuery);
    if (cached.ok) {
      const rows = await cached.json() as { response: { provenance: { cached: boolean } } }[];
      if (rows[0]) { rows[0].response.provenance.cached = true; return json(200, rows[0].response); }
    }
  } catch { /* the cache is an optimisation: score the point instead */ }

  let reference: Assets;
  try { reference = await loadAssets(); } catch (error) {
    console.error('reference data', error);
    return fail(503, 'upstream_unreachable', 'The matching service is not ready. Try again in a moment.');
  }
  const started = Date.now();
  let pack;
  try { pack = await fetchPack(body, lat, lon, { marsTiles: reference.marsTiles }); } catch (error) {
    if (error instanceof PackError) return fail(error.code === 'upstream_unreachable' ? 502 : 422, error.code, error.message);
    console.error('fetchPack', error);
    return fail(502, 'upstream_unreachable', 'The elevation archive could not be read. Try again in a moment.');
  }
  const resolution = RESOLUTION_M[body], vector = packFeatures({ rows: pack.rows, columns: pack.columns, data: pack.data }, pack.spacingM);
  const found = await context(body, lat, lon), table = reference.families?.[body];
  const unit = found?.unit ?? null, entry = unit ? table?.units[unit.unit] : undefined, family = entry?.family ?? null;
  // A map unit translated to a family by an unreviewed table earns what an unreviewed inferred label earns.
  const ranking = rank(vector, resolution, reference.earth, family, family ? INFERRED_FACTOR : 1, family ? 'geologic_map_unit_unreviewed' : undefined);
  const name = placeName(found?.feature ?? null, lat, lon);
  const id = `custom-${body.toLowerCase()}-${tag(lat, 'n', 's')}-${tag(lon, 'e', 'w')}`;
  const response = {
    method: METHOD,
    point: { body, lat, lon, name, name_source: name ? 'IAU Gazetteer of Planetary Nomenclature' : null },
    comparison_resolution_m: resolution,
    window_m: WINDOW_M,
    landform: {
      family, status: family ? 'geologic_map_unit_unreviewed' : 'unknown',
      unit: unit?.unit ?? null, unit_name: unit?.unit_name ?? entry?.unit_name ?? null,
      source: unit ? table?.source ?? null : null,
    },
    ranking_basis: family ? 'landform_and_terrain' : 'terrain_only',
    matches: ranking.matches,
    excluded_earth_sites: ranking.excluded_earth_sites,
    terrain: { manifest: packManifest(pack, id, name ?? 'Custom site'), elevation_base64: packBase64(pack) },
    provenance: {
      evidence_status: 'on_demand_unreviewed', scientifically_validated: false,
      terrain_range_percent: null, window_sensitivity: 'not_computed',
      dem: { product: SOURCES[body].product, url: SOURCES[body].url },
      range_requests: pack.rangeRequests, bytes_read: pack.bytesRead, compute_ms: Date.now() - started,
      cached: false,
    },
  };
  try {
    await rest('analog_click_cache', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ body, lat_q: lat, lon_q: lon, method_version: METHOD_KEY, response }) });
  } catch (error) { console.error('cache write', error); }
  return json(200, response);
}

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(handle);
export { handle };
