// Checks the deployed match-analog function against the same code run locally.
//   node supabase/verify.ts            (Node 22.18+ or 24: runs TypeScript directly)
// For each test point the deployed response must carry exactly the grid and the ranking this
// machine computes from the shared modules, so a bad deploy cannot pass. Also checks the cache,
// the error codes, and that the curated targets' published top results come back.
// Reads the public URL and anon key from web/.env. Uses the network; not part of `npm run check`.
import { readFileSync } from 'node:fs';
import { fetchPack, packBase64 } from './functions/_shared/analog/fetchPack.ts';
import { MARS_TILE_COUNTS, MARS_TILE_OFFSETS } from './functions/_shared/analog/marsTiles.ts';
import { packFeatures } from './functions/_shared/analog/describe.ts';
import { rank, RESOLUTION_M, type EarthVectors } from './functions/_shared/analog/score.ts';
import { INFERRED_FACTOR } from './functions/_shared/analog/landform.ts';

const root = new URL('..', import.meta.url);
const env = Object.fromEntries(readFileSync(new URL('web/.env', root), 'utf8').split(/\r?\n/).filter(line => line.includes('=')).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
const url = `${env.VITE_SUPABASE_URL}/functions/v1/match-analog`, key = env.VITE_SUPABASE_ANON_KEY;
const earth = JSON.parse(readFileSync(new URL('supabase/functions/_shared/analog/earth-vectors.json', root), 'utf8')) as EarthVectors;
const sites = JSON.parse(readFileSync(new URL('web/public/sites.json', root), 'utf8'));
const call = async (body: unknown) => {
  const started = Date.now(), response = await fetch(url, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { status: response.status, ms: Date.now() - started, data: await response.json() };
};
// Postgres jsonb does not keep key order, so cached responses are compared with keys sorted.
const canonical = (value: unknown): string => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
let failures = 0;
const check = (ok: boolean, label: string) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) failures++; };

const points: { label: string; body: 'Moon' | 'Mars'; lat: number; lon: number; target?: string }[] = [
  { label: 'Jezero', body: 'Mars', lat: 18.45, lon: 77.4, target: 'jezero' },
  { label: 'Marius Hills', body: 'Moon', lat: 14.1, lon: -56.8, target: 'marius-hills' },
  { label: 'Arsia Mons flank (a mapped volcanic unit)', body: 'Mars', lat: -8.5, lon: -121 },
  { label: 'Tycho floor (a mapped crater unit)', body: 'Moon', lat: -43.3, lon: -11.2 },
  { label: 'Mars date line', body: 'Mars', lat: -23.37, lon: 179.99 },
  { label: 'Mars high north', body: 'Mars', lat: 84.2, lon: -40 },
  { label: 'Moon far side', body: 'Moon', lat: -43.31, lon: -169.12 },
  { label: 'Moon near the south pole', body: 'Moon', lat: -89.5, lon: 12 },
];
for (const point of points) {
  const first = await call(point);
  if (first.status !== 200) { check(false, `${point.label}: HTTP ${first.status} ${JSON.stringify(first.data)}`); continue; }
  const remote = first.data, pack = await fetchPack(point.body, remote.point.lat, remote.point.lon, { marsTiles: { offsets: MARS_TILE_OFFSETS, counts: MARS_TILE_COUNTS } });
  const family = remote.landform.family as string | null;
  const local = rank(packFeatures(pack, pack.spacingM), RESOLUTION_M[point.body], earth, family, family ? INFERRED_FACTOR : 1, family ? 'geologic_map_unit_unreviewed' : undefined);
  check(remote.terrain.elevation_base64 === packBase64(pack), `${point.label}: deployed grid is byte-identical to the local read (${first.ms} ms${remote.provenance.cached ? ', cached' : ''})`);
  check(canonical(remote.matches) === canonical(local.matches) && remote.excluded_earth_sites === local.excluded_earth_sites, `${point.label}: deployed ranking equals the local ranking (${remote.matches.length} sites, ${remote.ranking_basis}, family ${family}, name ${remote.point.name})`);
  const second = await call(point);
  check(second.status === 200 && second.data.provenance.cached === true && canonical(second.data.matches) === canonical(remote.matches), `${point.label}: second call is a cache hit (${second.ms} ms)`);
  if (point.target) {
    // The curated target's published terrain similarity for each Earth site, within the C2 tolerance of 1.0 point.
    const published = new Map<string, number>(sites.analog_matching.comparisons.filter((row: { planetary_id: string }) => row.planetary_id === point.target).map((row: { earth_id: string; terrain_similarity_percent: number }) => [row.earth_id, row.terrain_similarity_percent]));
    let worst = 0, compared = 0;
    for (const row of remote.matches) { const value = published.get(row.earth_id); if (value != null) { worst = Math.max(worst, Math.abs(value - row.terrain_similarity_percent)); compared++; } }
    check(compared > 0 && worst <= 1.0, `${point.label}: terrain similarity within ${worst.toFixed(3)} points of the published figure for ${compared} published pairings`);
  }
}
const pole = await call({ body: 'Moon', lat: -89.97, lon: 0 });
check(pole.status === 422 && pole.data.code === 'out_of_range', `pole -> ${pole.status} ${pole.data.code}`);
const malformed = await call('{not json');
check(malformed.status === 400 && malformed.data.code === 'bad_request', `malformed -> ${malformed.status} ${malformed.data.code}`);
const wrongWorld = await call({ body: 'Venus', lat: 0, lon: 0 });
check(wrongWorld.status === 400 && wrongWorld.data.code === 'bad_request', `other world -> ${wrongWorld.status} ${wrongWorld.data.code}`);
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
