import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import recorded from './fixtures/analogClick.mars.json';
import sitesJson from '../../public/sites.json';
import { parseCatalog } from './catalog';
import { analyseClick, clickEvidence, ClickError, clickLandformLabel, clickScoreLabel, customAnalogs, customTarget, decodeClick, formatPoint, isCustomTarget, SERVICE_UNAVAILABLE, type ClickResponse } from './analogClick';
import { computeFidelity } from './fidelity';
import { isBaselineMission } from './landingSimilarity';
import { buildMission, defaultSettings, loadProfile } from './mission';
import { catalogSites } from '../data/sites';

// A response recorded from the deployed function for a point on the flank of Arsia Mons (-8.5, -121).
const response = recorded as unknown as ClickResponse;
const copy = (): ClickResponse => JSON.parse(JSON.stringify(recorded));
const catalog = parseCatalog(JSON.parse(JSON.stringify(sitesJson)));
const endpoint = { url: 'https://example.invalid/functions/v1/match-analog', key: 'anon' };
const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

describe('decoding a scored pin', () => {
  it('builds a terrain profile from the recorded response', () => {
    const { profile } = decodeClick(copy());
    expect(isCustomTarget(profile.manifest.id)).toBe(true);
    expect(profile.manifest.body).toBe('mars');
    expect([profile.manifest.grid.rows, profile.manifest.grid.columns, profile.sampleSpacingM]).toEqual([33, 33, 500]);
    expect(profile.buffer.byteLength).toBe(33 * 33 * 4);
    expect(profile.heightsM).toHaveLength(33);
    expect(profile.manifest.statistics?.relief_m).toBeGreaterThan(0);
  });
  it('rejects anything short of a complete answer instead of using part of it', () => {
    const cases: ((r: ClickResponse) => void)[] = [
      r => { r.terrain.elevation_base64 = r.terrain.elevation_base64.slice(0, 400); },
      r => { r.matches[3].terrain_similarity_percent = Number.NaN; },
      r => { (r.provenance as { scientifically_validated: boolean }).scientifically_validated = true; },
      r => { r.terrain.manifest.id = 'jezero'; },
      r => { (r as { ranking_basis: string }).ranking_basis = 'landform'; },
    ];
    for (const spoil of cases) { const bad = copy(); spoil(bad); expect(() => decodeClick(bad)).toThrowError(ClickError); }
    expect(() => decodeClick(null)).toThrowError(SERVICE_UNAVAILABLE);
  });
});

describe('a pinned point as a target', () => {
  it('becomes a synthetic planetary site that says how it was derived', () => {
    const target = customTarget(response);
    expect(target).toMatchObject({ id: response.terrain.manifest.id, name: 'Inside Arsia Mons', body: 'Mars', lat: -8.5, lon: -121, gravity: 3.72 });
    expect(target.region).toBe(formatPoint(-8.5, -121));
    expect(target.description).toMatch(/on demand/);
    expect(target.description).toMatch(/Not reviewed, not validated/);
    expect(target.description).toMatch(/geologic map unit Ave/);
    expect(catalog.targets.some(t => t.id === target.id)).toBe(false);
    const unnamed = copy(); unnamed.point.name = null;
    expect(customTarget(unnamed).name).toBe('Custom site');
    const moon = copy(); moon.point.body = 'Moon';
    expect(customTarget(moon).gravity).toBe(1.62);
  });
  it('lists Earth sites in the server order, available sites only', () => {
    const sites = customAnalogs(catalog, response), order = response.matches.map(row => row.earth_id);
    expect(sites.length).toBeGreaterThan(10);
    expect(sites.every(site => site.available)).toBe(true);
    expect(sites.map(site => site.id)).toEqual(order.filter(id => sites.some(site => site.id === id)));
    expect(sites[0].id).toBe(order[0]);
    const withUnknown = copy(); withUnknown.matches.unshift({ ...withUnknown.matches[0], earth_id: 'not-in-the-catalog' });
    expect(customAnalogs(catalog, withUnknown)[0].id).toBe(order[0]);
  });
  it('labels a landform-and-terrain ranking as an analog match with its landform source', () => {
    const top = response.matches[0];
    expect(clickScoreLabel(response, top.earth_id)).toBe(`${top.analog_score_percent.toFixed(1)}% analog match`);
    expect(clickLandformLabel(response, top.earth_id)).toMatch(/Same landform type \(inferred, unreviewed\) · terrain/);
    expect(clickScoreLabel(response, 'nowhere')).toBe('Not scored for this pin');
  });
  it('never presents a terrain-only ranking as a low analog match', () => {
    const terrainOnly = copy(); terrainOnly.ranking_basis = 'terrain_only'; terrainOnly.landform = { family: null, status: 'unknown', unit: 'HNt', unit_name: 'Hesperian and Noachian transition unit', source: 'USGS SIM 3292, 1:20M' };
    for (const row of terrainOnly.matches) { row.analog_score_percent = row.terrain_similarity_percent / 2; row.landform = { ...row.landform, planetary_family: null, relation: 'unknown', match_percent: 0 }; }
    const top = terrainOnly.matches[0], label = clickScoreLabel(terrainOnly, top.earth_id);
    expect(label).toBe(`${top.terrain_similarity_percent.toFixed(1)}% terrain match · landform unmapped`);
    expect(label).not.toMatch(/analog match/);
    expect(clickLandformLabel(terrainOnly, top.earth_id)).toBeNull();
    expect(customTarget(terrainOnly).description).toMatch(/landform unmapped/);
    expect(clickEvidence(terrainOnly).basis).toMatch(/landform unmapped/);
  });
  it('states the limits every screen must show', () => {
    const { basis, limits } = clickEvidence(response);
    expect(basis).toMatch(/4 km window/); expect(basis).toMatch(/MOLA elevation mosaic at 500 m/); expect(basis).toMatch(/counted at 75%/);
    expect(limits.join(' ')).toMatch(/Not reviewed and not validated/);
    expect(limits.join(' ')).toMatch(/cannot be compared with Moon scores/);
  });
});

describe('calling the matching service', () => {
  it('returns the decoded result and sends the snapped request with the anon key', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const result = await analyseClick('Mars', -8.5, -121, { endpoint, fetch: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return answer(200, copy()); }) as typeof fetch });
    expect(result.response.point.name).toBe('Inside Arsia Mons');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(endpoint.url);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ body: 'Mars', lat: -8.5, lon: -121 });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer anon');
  });
  it('says the service is unavailable when it is not configured, without calling anything', async () => {
    const never = vi.fn();
    await expect(analyseClick('Mars', 0, 0, { endpoint: null, fetch: never as unknown as typeof fetch })).rejects.toMatchObject({ code: 'unavailable', message: SERVICE_UNAVAILABLE });
    expect(never).not.toHaveBeenCalled();
  });
  it('retries once on a network failure or a server error, then reports unavailable', async () => {
    let calls = 0;
    await expect(analyseClick('Moon', 1, 2, { endpoint, fetch: (async () => { calls++; throw new TypeError('offline'); }) as typeof fetch })).rejects.toMatchObject({ code: 'unavailable' });
    expect(calls).toBe(2);
    calls = 0;
    const result = await analyseClick('Mars', -8.5, -121, { endpoint, fetch: (async () => ++calls === 1 ? answer(502, { code: 'upstream_unreachable', message: 'x' }) : answer(200, copy())) as typeof fetch });
    expect(calls).toBe(2); expect(result.response.matches.length).toBeGreaterThan(0);
  });
  it('passes on the service\'s own sentence for a point it cannot score, without retrying', async () => {
    let calls = 0;
    const message = 'Points within 0.1 degrees of a pole cannot be analysed: the elevation mosaic is unreliable there.';
    await expect(analyseClick('Moon', -89.97, 0, { endpoint, fetch: (async () => { calls++; return answer(422, { code: 'out_of_range', message }); }) as typeof fetch })).rejects.toMatchObject({ code: 'out_of_range', message });
    expect(calls).toBe(1);
    await expect(analyseClick('Mars', 0, 0, { endpoint, fetch: (async () => answer(401, { message: 'Invalid JWT' })) as typeof fetch })).rejects.toMatchObject({ code: 'unavailable' });
  });
  it('times out and stops when the caller aborts', async () => {
    const hang = ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))) as unknown as typeof fetch;
    await expect(analyseClick('Mars', 0, 0, { endpoint, fetch: hang, timeoutMs: 20, retries: 0 })).rejects.toMatchObject({ code: 'unavailable' });
    const abort = new AbortController(), pending = analyseClick('Mars', 0, 0, { endpoint, fetch: hang, signal: abort.signal });
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('the debrief for a pinned point', () => {
  it('flies the comparison landings on the fetched terrain with no catalog entry', async () => {
    vi.stubGlobal('fetch', async (url: string) => new Response(readFileSync(new URL(`../../public${url}`, import.meta.url))));
    const { profile: planetary } = decodeClick(copy()), target = customTarget(response);
    const earth = customAnalogs(catalog, response)[0], analogProfile = await loadProfile(undefined, earth.manifestUrl, earth.id);
    const mission = buildMission(target, analogProfile, defaultSettings, { terrainScore: response.matches[0].terrain_similarity_percent / 100, analogName: earth.name });
    expect(mission.planetaryTarget).toEqual({ id: target.id, name: target.name, body: 'Mars', gravity: 3.72 });
    expect(catalogSites.some(site => site.id === target.id)).toBe(false);
    // Without the fetched terrain there is nothing to compare against: the catalog path refuses.
    await expect(computeFidelity(mission, analogProfile, catalogSites.find(site => site.id === earth.id))).rejects.toThrow(/not in the site catalog/);
    vi.stubGlobal('fetch', async () => { throw new Error('a pinned point must not download a pack or a baseline'); });
    const report = await computeFidelity(mission, analogProfile, catalogSites.find(site => site.id === earth.id), undefined, undefined, planetary);
    expect(Number.isFinite(report.guided.score)).toBe(true);
    expect(Number.isFinite(report.stress.score)).toBe(true);
    expect(Number.isFinite(report.stress.planetary.successRate)).toBe(true);
    // The cached baseline is keyed by catalog pairs; even a baseline-shaped mission finds no row for a pin.
    expect(isBaselineMission(mission)).toBe(true);
    // Terrain from another world or another target is refused rather than flown.
    const wrong = decodeClick(copy()).profile; wrong.manifest.id = 'custom-mars-0.00n-0.00e';
    await expect(computeFidelity(mission, analogProfile, undefined, undefined, undefined, wrong)).rejects.toThrow(/does not belong/);
  });
});
