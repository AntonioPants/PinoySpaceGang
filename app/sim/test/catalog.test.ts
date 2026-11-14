import { describe, expect, it } from 'vitest';
import { analogFidelity, pairingsFor, runSim, siteInterference } from '../src/index.ts';
import { loadCatalogSite, readCatalog } from '../scripts/catalog-node.ts';
import { readFileSync } from 'node:fs';

const catalog = readCatalog();

describe('site catalog adapter', () => {
  it('includes complete seasonal profiles with their separate baseline and unknown mechanics', () => {
    const site = loadCatalogSite(catalog, 'kilbourne-hole-v1');
    const profile = JSON.parse(readFileSync(new URL('../../../data/environment/kilbourne_hole.json', import.meta.url), 'utf8'));
    expect(site.catalog?.environment.profile).toEqual(profile);
    expect(loadCatalogSite(catalog, 'jezero').catalog?.environment.status).toBe('unavailable');
  });
  it('preserves all categories, quantities and unknowns without dropping provenance', () => {
    for (const entry of catalog.sites.filter(s => s.terrain)) {
      const site = loadCatalogSite(catalog, entry.id);
      expect(site.catalog?.record).toEqual(entry);
      expect(site.catalog?.pairings).toEqual(catalog.pairings.filter(p => p.earth_id === entry.id || p.planetary_id === entry.id));
    }
  });
});
