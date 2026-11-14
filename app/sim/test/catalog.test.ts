import { describe, expect, it } from 'vitest';
import { analogFidelity, pairingsFor, runSim, siteInterference } from '../src/index.ts';
import { loadCatalogSite, readCatalog } from '../scripts/catalog-node.ts';

const catalog = readCatalog();

describe('site catalog adapter', () => {
  it('loads every site that has terrain', () => {
    for (const entry of catalog.sites.filter((s) => s.terrain)) {
      const site = loadCatalogSite(catalog, entry.id);
      expect(site.heightmap.heights.length).toBe(entry.terrain!.rows * entry.terrain!.columns);
      expect(site.heightmap.cellSize).toBe(entry.terrain!.spacing_m);
    }
  });

  it('maps catalog conditions to physics inputs, with sources', () => {
    const k = loadCatalogSite(catalog, 'kilbourne-hole-v1');
    const entry = catalog.sites.find((s) => s.id === 'kilbourne-hole-v1')!;
    expect(k.albedo).toBe(entry.conditions.albedo.value);
    expect(Math.hypot(k.wind!.x, k.wind!.y)).toBeCloseTo(entry.conditions.wind_speed_10m.value!, 6);
    expect(k.soilType).toBe('basalt');
    expect(k.sources!.wind_speed_10m).toMatch(/direction assumed/);
    // best pairing for Kilbourne is arsia-flank (Mars)
    expect(pairingsFor(catalog, k.id)[0].planetary_id).toBe('arsia-flank');
    expect(k.analogOf).toBe('mars');
  });

  it('derives harsher camera conditions at the lunar pole than at mid-latitude Earth', () => {
    const pole = siteInterference(loadCatalogSite(catalog, 'shackleton-rim'));
    const desert = siteInterference(loadCatalogSite(catalog, 'white-sands'));
    expect(pole.dust).toBeGreaterThan(desert.dust); // fine regolith vs gypsum sand
    expect(loadCatalogSite(catalog, 'shackleton-rim').sunElevationDeg).toBeLessThan(1);
  });

  it('the autopilot lands at a target on a crater wall (Meteor Crater) by diverting', () => {
    const tel = runSim({ site: { ...loadCatalogSite(catalog, 'meteor-crater'), analogOf: 'moon' }, strategy: 'autonomous' });
    expect(tel.summary!.diverted).toBe(true);
    expect(tel.summary!.outcome).toBe('success');
  });
});

describe('analog fidelity', () => {
  it('a site compared with itself scores 100', () => {
    const moon = loadCatalogSite(catalog, 'marius-hills');
    expect(analogFidelity(moon, { ...moon, body: 'earth' }, { seeds: [1] }).score).toBe(100);
  });

  it('scores a catalog pairing and reports both flights', () => {
    const p = catalog.pairings.find((x) => x.earth_id === 'craters-moon' && x.planetary_id === 'marius-hills')!;
    const r = analogFidelity(loadCatalogSite(catalog, p.planetary_id), loadCatalogSite(catalog, p.earth_id), {
      seeds: [1, 2],
      catalogTerrainScore: p.terrain_score,
    });
    expect(r.gravity).toBe(1.62);
    expect(r.score).toBeGreaterThan(50);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.planetary.outcomes).toHaveLength(2);
    expect(r.catalogTerrainScore).toBe(p.terrain_score);
  });

  it('drops when the analog flight ends differently', () => {
    const moon = loadCatalogSite(catalog, 'marius-hills');
    const rocky = { ...moon, id: 'rocky-twin', body: 'earth' as const, rockAbundance: 0.3 };
    const blind = { base: { sensors: { hazard: 'none' as const } }, seeds: [1, 2, 3, 4, 5, 6] };
    expect(analogFidelity(moon, rocky, blind).score).toBeLessThan(analogFidelity(moon, { ...moon, body: 'earth' }, blind).score);
  });

  it('refuses an Earth site as the planetary side', () => {
    const earth = loadCatalogSite(catalog, 'amboy');
    expect(() => analogFidelity(earth, earth)).toThrow(/Moon\/Mars/);
  });
});
