import { describe, expect, it } from 'vitest';
import { analogFidelity, pairingsFor, runSim, siteInterference, stressFidelity } from '../src/index.ts';
import { loadCatalogSite, readCatalog } from '../scripts/catalog-node.ts';

const catalog = readCatalog();

describe('site catalog adapter', { timeout: 30_000 }, () => {
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
    expect(k.soilType).toBe('basalt');
    expect(k.sources!.albedo).toBeTruthy();
    expect(pairingsFor(catalog, k.id)[0].planetary_id).toBe('arsia-flank');
  });

  it('infers nothing: no analog body and no wind vector unless the caller chooses them', () => {
    const k = loadCatalogSite(catalog, 'kilbourne-hole-v1');
    expect(k.analogOf).toBeUndefined();
    expect(k.wind).toBeUndefined();
    const chosen = loadCatalogSite(catalog, 'kilbourne-hole-v1', { analogOf: 'mars', windTowardDeg: 90 });
    const speed = catalog.sites.find((s) => s.id === 'kilbourne-hole-v1')!.conditions.wind_speed_10m.value!;
    expect(chosen.analogOf).toBe('mars');
    expect(chosen.wind!.x).toBeCloseTo(speed, 6);
    expect(chosen.sources!.wind_speed_10m).toMatch(/scenario assumption/);
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

describe('analog fidelity', { timeout: 30_000 }, () => {
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

describe('stress fidelity', { timeout: 60_000 }, () => {
  it('a site compared with itself scores 100', () => {
    const moon = loadCatalogSite(catalog, 'marius-hills');
    const r = stressFidelity(moon, { ...moon, body: 'earth' }, { gridSize: 3 });
    expect(r.score).toBe(100);
    expect(r.planetary.flights).toBe(9);
  });

  it('flies blind whatever sensor the mission configured', () => {
    const r = stressFidelity(loadCatalogSite(catalog, 'jezero'), loadCatalogSite(catalog, 'capitol-reef'), {
      gridSize: 3,
      base: { sensors: { hazard: 'lidar' } },
    });
    expect(r.method).toMatch(/blind landings/);
    expect(r.assumedRockAbundance).toBe(0);
  });

  it('separates a rugged analog from a gentle one for the same target', () => {
    const arsia = loadCatalogSite(catalog, 'arsia-flank');
    const gentle = stressFidelity(arsia, loadCatalogSite(catalog, 'amboy'));
    const rugged = stressFidelity(arsia, loadCatalogSite(catalog, 'craters-moon'));
    expect(rugged.analog.successRate).toBeLessThan(gentle.analog.successRate);
    expect(rugged.score).toBeLessThan(gentle.score - 10);
  });

  it('labels an assumed rock abundance in the method', () => {
    const moon = loadCatalogSite(catalog, 'marius-hills');
    const r = stressFidelity(moon, { ...moon, body: 'earth' }, { gridSize: 2, assumedRockAbundance: 0.1 });
    expect(r.method).toMatch(/assumed 10% rock abundance/);
  });
});
