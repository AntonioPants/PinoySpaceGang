// Terrain window readers. The geometry tests run everywhere; the tests that reach the public
// elevation archives run only with ANALOG_NETWORK=1 (kept out of `npm run check`):
//   cd web && ANALOG_NETWORK=1 npx vitest run src/lib/analogReaders.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetchPack, inverseAeqd, packBase64, packManifest, PackError, sampleGeometry, SOURCES, taps } from '../../../supabase/functions/_shared/analog/fetchPack.ts';
import { MARS_TILE_COUNTS, MARS_TILE_OFFSETS } from '../../../supabase/functions/_shared/analog/marsTiles.ts';
import { packFeatures } from '../../../supabase/functions/_shared/analog/describe.ts';
import { rank, type EarthVectors } from '../../../supabase/functions/_shared/analog/score.ts';
import { FAMILIES } from '../../../supabase/functions/_shared/analog/landform.ts';
import { extractProfile } from './mission';
import type { TerrainManifest } from './types';

const shared = resolve(__dirname, '../../../supabase/functions/_shared/analog');
const earth = JSON.parse(readFileSync(resolve(shared, 'earth-vectors.json'), 'utf8')) as EarthVectors;
const fixtures = JSON.parse(readFileSync(resolve(shared, 'fixtures.json'), 'utf8')) as {
  targets: Record<string, { body: string; morphology: string; spacing_m: number; resolution_m: number }>;
  published_screening: [string, string, number][];
};
const sites = JSON.parse(readFileSync(resolve(__dirname, '../../public/sites.json'), 'utf8')) as { sites: { id: string; latitude: number; longitude: number }[] };
const network = process.env.ANALOG_NETWORK === '1';

describe('terrain window geometry', () => {
  it('inverts the azimuthal-equidistant projection', () => {
    const R = 1737400, rad = Math.PI / 180;
    expect(inverseAeqd(0, 0, 10 * rad, 20 * rad, R)).toEqual({ lat: 10 * rad, lon: 20 * rad });
    const north = inverseAeqd(0, R * rad, 10 * rad, 20 * rad, R);
    expect(north.lat / rad).toBeCloseTo(11, 9); expect(north.lon / rad).toBeCloseTo(20, 9);
    const east = inverseAeqd(R * rad, 0, 0, 20 * rad, R);
    expect(east.lat).toBeCloseTo(0, 12); expect(east.lon / rad).toBeCloseTo(21, 9);
    // Across the pole: 2 degrees north of 89 N lands at 89 N on the opposite meridian.
    const over = inverseAeqd(0, 2 * R * rad, 89 * rad, 0, R);
    expect(over.lat / rad).toBeCloseTo(89, 6); expect(Math.abs(over.lon / rad)).toBeCloseTo(180, 6);
  });

  it('wraps columns at the date line and clamps rows, with no bounding box', () => {
    for (const body of ['Moon', 'Mars'] as const) {
      const s = SOURCES[body], geometry = sampleGeometry(body, 0, 180);
      expect(geometry.samples).toHaveLength(1089);
      const all = geometry.samples.flatMap(sample => taps(body, sample, geometry.kx, geometry.ky));
      expect(all.every(t => t.col >= 0 && t.col < s.width && t.row >= 0 && t.row < s.height)).toBe(true);
      expect(all.some(t => t.col > s.width - 100) && all.some(t => t.col < 100)).toBe(true);
      // The centre cell of a pack at (0, 0) falls on the middle of the raster.
      const centre = sampleGeometry(body, 0, 0).samples[16 * 33 + 16];
      expect(centre.row).toBeCloseTo(s.height / 2 - 0.5, 3); expect(centre.col).toBeCloseTo(s.width / 2 - 0.5, 3);
      // At the equator an output cell is barely larger than a source pixel in both axes.
      expect(geometry.kx).toBeCloseTo(s.spacingM / s.pixelM, 2); expect(geometry.ky).toBeCloseTo(s.spacingM / s.pixelM, 2);
    }
    // Plain bilinear: four taps whose weights sum to one.
    const four = taps('Mars', { row: 10.25, col: 20.75 }, 1, 1);
    expect(four.map(t => [t.row, t.col])).toEqual([[10, 20], [10, 21], [11, 20], [11, 21]]);
    expect(four.map(t => t.weight)).toEqual([0.1875, 0.5625, 0.0625, 0.1875]);
    // 89.55 S on the Moon: about 45 rows; the kernel widens in longitude only.
    const polar = sampleGeometry('Moon', -89.55, 30), rows = new Set(polar.samples.map(p => Math.floor(p.row)));
    expect(rows.size).toBeLessThan(60); expect(polar.kx).toBeGreaterThan(100); expect(polar.ky).toBeLessThan(1.5);
  });

  it('rejects poles and bad coordinates before any request', async () => {
    const never = (() => { throw new Error('no request expected'); }) as unknown as typeof fetch;
    await expect(fetchPack('Moon', -89.95, 0, { fetch: never })).rejects.toMatchObject({ code: 'out_of_range' });
    await expect(fetchPack('Mars', 89.9, 0, { fetch: never })).rejects.toMatchObject({ code: 'out_of_range' });
    await expect(fetchPack('Mars', Number.NaN, 0, { fetch: never })).rejects.toBeInstanceOf(PackError);
  });

  it('reports an unreachable archive and missing data as typed errors', async () => {
    const down = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    await expect(fetchPack('Moon', 10, 10, { fetch: down, retries: 0 })).rejects.toMatchObject({ code: 'upstream_unreachable' });
    // A Moon archive that answers every range with the nodata value.
    const empty = (async (_url: string, init: RequestInit) => {
      const [, a, b] = /bytes=(\d+)-(\d+)/.exec((init.headers as Record<string, string>).Range)!;
      const bytes = new Uint8Array(Number(b) - Number(a) + 1); new Int16Array(bytes.buffer).fill(-32768);
      return new Response(bytes, { status: 206 });
    }) as unknown as typeof fetch;
    await expect(fetchPack('Moon', 10, 10, { fetch: empty })).rejects.toMatchObject({ code: 'no_data' });
  });

  it('reads a synthetic Moon archive (plain bilinear), scaled by 0.5, into a profile the game accepts', async () => {
    // Elevation = raster row (in half-metres), so the grid must fall linearly to the south.
    const flat = (async (_url: string, init: RequestInit) => {
      const [, a, b] = /bytes=(\d+)-(\d+)/.exec((init.headers as Record<string, string>).Range)!;
      const row = Math.floor((Number(a) - 738233) / 184320), bytes = new Uint8Array(Number(b) - Number(a) + 1);
      new Int16Array(bytes.buffer).fill(row - 23040);
      return new Response(bytes, { status: 206 });
    }) as unknown as typeof fetch;
    const pack = await fetchPack('Moon', 0, 0, { fetch: flat, widenKernel: false });
    const step = 0.5 * 150 / SOURCES.Moon.pixelM;
    expect(pack.data[0] - pack.data[33]).toBeCloseTo(-step, 4);
    expect(pack.data[16 * 33 + 16]).toBeCloseTo(-0.25, 4);
    const manifest = packManifest(pack, 'custom-moon-0.00-0.00', 'Custom site') as unknown as TerrainManifest;
    const buffer = Uint8Array.from(atob(packBase64(pack)), ch => ch.charCodeAt(0)).buffer;
    const profile = extractProfile(manifest, buffer);
    expect(profile.heightsM).toHaveLength(33); expect(profile.sampleSpacingM).toBe(150);
  });
});

describe.skipIf(!network)('terrain window readers against the public archives', () => {
  const published = new Map(fixtures.published_screening.map(([e, p, score]) => [`${e}|${p}`, score]));
  for (const [id, target] of Object.entries(fixtures.targets)) {
    it(`${id}: grid within 2 m RMS of the committed pack, scores within 1.0 point`, async () => {
      const site = sites.sites.find(s => s.id === id)!, body = target.body === 'mars' ? 'Mars' : 'Moon';
      const started = Date.now(), pack = await fetchPack(body, site.latitude, site.longitude, { marsTiles: { offsets: MARS_TILE_OFFSETS, counts: MARS_TILE_COUNTS } });
      const raw = readFileSync(resolve(__dirname, `../../public/terrain/${id}/elevation.f32`));
      const committed = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
      let sum = 0, worst = 0;
      for (let i = 0; i < 1089; i++) { const d = pack.data[i] - committed[i]; sum += d * d; worst = Math.max(worst, Math.abs(d)); }
      const rms = Math.sqrt(sum / 1089);
      const result = rank(packFeatures(pack, target.spacing_m), target.resolution_m, earth, FAMILIES[target.morphology]);
      let delta = 0, compared = 0;
      for (const row of result.matches) { const expected = published.get(`${row.earth_id}|${id}`); if (expected !== undefined) { delta = Math.max(delta, Math.abs(row.analog_score_percent - expected)); compared++; } }
      console.info(`${id}: rms ${rms.toFixed(3)} m, max ${worst.toFixed(2)} m, max score delta ${delta.toFixed(3)} over ${compared} pairs, ${pack.rangeRequests} requests, ${(pack.bytesRead / 1024).toFixed(0)} KiB, ${Date.now() - started} ms`);
      expect(compared).toBeGreaterThan(90);
      expect(rms).toBeLessThanOrEqual(2);
      expect(delta).toBeLessThanOrEqual(1.0);
    }, 120_000);
  }
});
