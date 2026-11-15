import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatMineral, mineralColour, mineralRange, sampleMineral, type MineralMap } from './minerals';

const layer = { key: 'feo', name: 'Iron oxide (FeO)', unit: 'wt%', min: 1, max: 4, mean: 2.5, values: [1, 2, 3, null] as (number | null)[] };
const map: MineralMap = { id: 'x', body: 'moon', kind: 'map', grid: { rows: 2, columns: 2 }, extent_m: { width: 4800, depth: 4800 },
  source: { dataset: 'd', citation: 'c', page: 'https://example.org', native_resolution_m: 59, retrieved: '2026-01-01' }, layers: [layer], caveats: [] };

describe('mineral map sampling', () => {
  it('reads the cell under a point: north-first rows, west-first columns, gaps stay gaps', () => {
    expect(sampleMineral(map, layer, -1000, 1000)).toBe(1);    // north-west
    expect(sampleMineral(map, layer, 1000, 1000)).toBe(2);     // north-east
    expect(sampleMineral(map, layer, -1000, -1000)).toBe(3);   // south-west
    expect(sampleMineral(map, layer, 1000, -1000)).toBeNull(); // no data in the source
    expect(sampleMineral(map, layer, 2400, 2400)).toBe(2);     // the edge belongs to the area
    expect(sampleMineral(map, layer, 2500, 0)).toBeNull();     // outside it: never extrapolated
    expect(sampleMineral(map, layer, NaN, 0)).toBeNull();
  });
  it('gives one regional value everywhere inside the area', () => {
    const one = { ...layer, min: 13, max: 13, mean: 13, values: [13] };
    const regional: MineralMap = { ...map, body: 'mars', kind: 'regional', grid: { rows: 1, columns: 1 }, extent_m: { width: 16000, depth: 16000 }, layers: [one] };
    expect(sampleMineral(regional, one, -7000, 7000)).toBe(13);
    expect(sampleMineral(regional, one, 2400, -2400)).toBe(13);
    expect(mineralRange(regional, one)).toEqual([0, 30]);       // a fixed scale, so one value still has a place on it
    expect(mineralRange(map, layer)).toEqual([1, 4]);           // a map stretches over the site's own range
  });
  it('colours low to high from dark to light, clamped at the ends', () => {
    const light = ([r, g, b]: number[]) => .2126 * r + .7152 * g + .0722 * b;
    const steps = [0, .25, .5, .75, 1].map(t => light(mineralColour(1 + 3 * t, [1, 4])));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(mineralColour(-5, [1, 4])).toEqual(mineralColour(1, [1, 4]));
    expect(mineralColour(99, [1, 4])).toEqual(mineralColour(4, [1, 4]));
    expect(formatMineral(19.62, 'wt%')).toBe('20 wt%');
    expect(formatMineral(8.48, '%')).toBe('8.5%');
  });
});

describe('published mineral files', () => {
  const dir = resolve(__dirname, '../../public/minerals');
  const index = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8')) as { sites: Record<string, string>; unavailable: Record<string, string> };
  it('has a readable record for every listed site and a reason for every site without one', () => {
    expect(Object.keys(index.sites).length).toBeGreaterThan(0);
    for (const [id, kind] of Object.entries(index.sites)) {
      const record = JSON.parse(readFileSync(resolve(dir, `${id}.json`), 'utf8')) as MineralMap;
      expect(record.id).toBe(id);
      expect(record.kind).toBe(kind);
      for (const l of record.layers) {
        expect(l.values).toHaveLength(record.grid.rows * record.grid.columns);
        const centre = sampleMineral(record, l, 0, 0);
        if (centre !== null) { expect(centre).toBeGreaterThanOrEqual(l.min); expect(centre).toBeLessThanOrEqual(l.max); }
      }
    }
    for (const [id, reason] of Object.entries(index.unavailable)) {
      expect(reason.length).toBeGreaterThan(10);
      expect(existsSync(resolve(dir, `${id}.json`))).toBe(false);
    }
  });
});
