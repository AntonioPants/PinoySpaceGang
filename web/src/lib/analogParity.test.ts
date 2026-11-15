// Parity of the click-anywhere scoring module with the Python pipeline and the published catalog.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packFeatures, centralWindow, type FeatureVector } from '../../../supabase/functions/_shared/analog/describe.ts';
import { combine, rank, resolutionKey, terrainPercent, type EarthVectors } from '../../../supabase/functions/_shared/analog/score.ts';
import { landform, landformForFamily, FAMILIES } from '../../../supabase/functions/_shared/analog/landform.ts';

const shared = resolve(__dirname, '../../../supabase/functions/_shared/analog');
const earth = JSON.parse(readFileSync(resolve(shared, 'earth-vectors.json'), 'utf8')) as EarthVectors;
interface Target { body: string; morphology: string; spacing_m: number; resolution_m: number; vector: FeatureVector }
const fixtures = JSON.parse(readFileSync(resolve(shared, 'fixtures.json'), 'utf8')) as {
  targets: Record<string, Target>;
  published_comparisons: { earth_id: string; planetary_id: string; terrain_similarity_percent: number; analog_score_percent: number; landform: unknown }[];
  published_screening: [string, string, number][];
};
const pack = (id: string) => {
  const raw = readFileSync(resolve(__dirname, `../../public/terrain/${id}/elevation.f32`));
  return { rows: 33, columns: 33, data: new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength)) };
};
const vectors = Object.fromEntries(Object.entries(fixtures.targets).map(([id, t]) => [id, packFeatures(pack(id), t.spacing_m)]));
// The publisher rounds to 4 decimals before anything else; follow the same chain.
const two = (v: number) => Math.round(Math.round(v * 1e4) / 100) / 100;
/** Features that count cells: one cell may flip on a tie. */
const SHARES = /^(slope_gt_|bowl_share|ridge_share)/;

describe('click-anywhere scoring parity', () => {
  it('reproduces the Python descriptors of every planetary pack', () => {
    expect(Object.keys(fixtures.targets).length).toBeGreaterThanOrEqual(9);
    let worst = 0;
    for (const [id, target] of Object.entries(fixtures.targets)) {
      const mine = vectors[id], n = centralWindow(pack(id), target.spacing_m).rows;
      expect(Object.keys(mine).sort()).toEqual(Object.keys(target.vector).sort());
      for (const [key, expected] of Object.entries(target.vector)) {
        const actual = mine[key];
        if (expected === null) { expect(actual, `${id}.${key}`).toBeNull(); continue; }
        expect(actual, `${id}.${key}`).not.toBeNull();
        if (SHARES.test(key)) { expect(Math.abs(actual! - expected), `${id}.${key}`).toBeLessThanOrEqual(1 / ((n - 6) * (n - 6)) + 1e-12); continue; }
        const relative = Math.abs(actual! - expected) / Math.max(Math.abs(expected), 1e-12);
        worst = Math.max(worst, relative);
        expect(relative, `${id}.${key}: ${actual} vs ${expected}`).toBeLessThan(1e-6);
      }
    }
    console.info(`worst relative descriptor difference: ${worst.toExponential(2)}`);
  });

  it('reproduces every published comparison to 2 decimals', () => {
    expect(fixtures.published_comparisons.length).toBeGreaterThan(80);
    for (const row of fixtures.published_comparisons) {
      const target = fixtures.targets[row.planetary_id], key = resolutionKey(target.resolution_m), site = earth.sites[row.earth_id];
      const terrain = terrainPercent(site.vectors[key], vectors[row.planetary_id], earth.scales_by_resolution_m[key])!;
      const form = landform(site.morphology, target.morphology, site.inferred_landforms);
      expect(form).toEqual(row.landform);
      expect(two(terrain), `${row.earth_id} x ${row.planetary_id} terrain`).toBe(two(row.terrain_similarity_percent));
      expect(two(combine(terrain, form.match_percent)!), `${row.earth_id} x ${row.planetary_id}`).toBe(two(row.analog_score_percent));
    }
  });

  it('reproduces the published analog score of every screened pair through rank()', () => {
    const published = new Map(fixtures.published_screening.map(([e, p, score]) => [`${e}|${p}`, score]));
    expect(published.size).toBe(fixtures.published_screening.length);
    let checked = 0;
    for (const [id, target] of Object.entries(fixtures.targets)) {
      const result = rank(vectors[id], target.resolution_m, earth, FAMILIES[target.morphology]);
      expect(result.matches.length + result.excluded_earth_sites).toBe(Object.keys(earth.sites).length);
      for (let i = 1; i < result.matches.length; i++) expect(result.matches[i - 1].analog_score_percent).toBeGreaterThanOrEqual(result.matches[i].analog_score_percent);
      for (const row of result.matches) {
        const expected = published.get(`${row.earth_id}|${id}`);
        if (expected === undefined) continue;
        expect(two(row.analog_score_percent), `${row.earth_id} x ${id}`).toBe(two(expected));
        checked++;
      }
    }
    expect(checked).toBe(published.size);
  });

  it('keeps the landform rules: inferred labels at 75%, craters never inferred, unknown is terrain-only', () => {
    expect(landform('crater', 'volcanic_plain')).toEqual({ earth_family: 'crater', planetary_family: 'volcanic', relation: 'related_family', match_percent: 50, status: 'interpretation_only' });
    expect(landform(null, 'crater', ['impact_crater']).relation).toBe('unknown');
    expect(landform(null, 'volcanic_plain', ['lava_field'])).toMatchObject({ earth_family: 'volcanic', match_percent: 75, status: 'inferred_from_scan_region_unreviewed' });
    expect(landform(null, 'volcanic_plain', ['impact_crater', 'dune_field']).match_percent).toBe(0);
    expect(landformForFamily('lava_field', 'volcanic', [], 0.75, 'geologic_map_unit_unreviewed')).toMatchObject({ match_percent: 75, status: 'geologic_map_unit_unreviewed' });
    expect(landformForFamily(null, 'volcanic', ['lava_field'], 0.75, 'geologic_map_unit_unreviewed').match_percent).toBe(75);
    expect(landformForFamily('lava_field', null)).toMatchObject({ relation: 'unknown', match_percent: 0 });
    const unmapped = rank(vectors.jezero, 500, earth, null);
    expect(Math.max(...unmapped.matches.map(m => m.analog_score_percent))).toBeLessThanOrEqual(50);
    expect(unmapped.matches.every(m => m.analog_score_percent === Math.round(m.terrain_similarity_percent * 5000) / 1e4 || Math.abs(m.analog_score_percent - m.terrain_similarity_percent / 2) < 1e-4)).toBe(true);
  });

  it('excludes and counts an Earth site that lacks a frozen feature', () => {
    const copy = structuredClone(earth), id = Object.keys(copy.sites)[0];
    copy.sites[id].vectors['500.0']!.relief = null;
    const result = rank(vectors.jezero, 500, copy, 'sedimentary');
    expect(result.excluded_earth_sites).toBe(1);
    expect(result.matches.some(m => m.earth_id === id)).toBe(false);
  });
});
