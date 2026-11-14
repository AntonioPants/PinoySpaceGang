import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { loadTerrainPacks, loadViewerCatalog } from '../viewer/catalog.ts';

const publicRoot = new URL('../../../web/public/', import.meta.url);
const localFetch: typeof fetch = async (input) => {
  try {
    const url = new URL(String(input));
    return new Response(new Uint8Array(await readFile(new URL(url.pathname.slice(1), publicRoot))));
  } catch { return new Response('', { status: 404 }); }
};

describe('production catalog integration', () => {
  it('loads every real site and explicit pairing with south-first elevation samples', async () => {
    const sites = await loadTerrainPacks('/sites.json', localFetch);
    const catalog = JSON.parse(await readFile(new URL('sites.json', publicRoot), 'utf8'));
    expect(sites).toHaveLength(catalog.sites.length + catalog.pairings.length);
    for (const entry of catalog.sites) {
      const site = sites.find(s => s.id === entry.id)!;
      expect(site.body).toBe(entry.body);
      expect(site.analogOf).toBeUndefined();
      const url = new URL(entry.terrain.manifest_url.slice(1), publicRoot);
      const manifest = JSON.parse(await readFile(url, 'utf8'));
      const data = await readFile(new URL(manifest.grid.sample_file, url));
      expect(site.heightmap.heights[0]).toBe(data.readFloatLE((manifest.grid.rows - 1) * manifest.grid.columns * 4));
    }
    expect(sites.find(s => s.id === 'kilbourne-hole-v1--shackleton-rim')?.analogOf).toBe('moon');
    expect(sites.find(s => s.id === 'kilbourne-hole-v1--arsia-flank')?.analogOf).toBe('mars');
  });
  it('reports failed catalog fetches', async () => {
    await expect(loadTerrainPacks('/missing.json', localFetch)).rejects.toThrow('HTTP 404');
  });
  it('keeps failed packs unavailable while retaining working terrain', async () => {
    const brokenFetch: typeof fetch = (input, init) => String(input).includes('/amboy/elevation.f32')
      ? Promise.resolve(new Response('', { status: 404 })) : localFetch(input, init);
    const result = await loadViewerCatalog('/sites.json', brokenFetch);
    expect(result.sites.some(s => s.id === 'kilbourne-hole-v1')).toBe(true);
    expect(result.sites.some(s => s.id.startsWith('amboy'))).toBe(false);
    expect(result.unavailable.find(s => s.id === 'amboy')?.reason).toContain('HTTP 404');
    expect(result.unavailable.map(s => s.id)).toEqual(['amboy', 'haughton', 'qaidam']);
  });
  it('does not substitute terrain for a catalog record with no pack', async () => {
    const missingFetch: typeof fetch = async (input, init) => {
      const response = await localFetch(input, init);
      if (!String(input).endsWith('/sites.json')) return response;
      const catalog = await response.json();
      catalog.sites.find((s: { id: string }) => s.id === 'amboy').terrain = null;
      return new Response(JSON.stringify(catalog));
    };
    const result = await loadViewerCatalog('/sites.json', missingFetch);
    expect(result.unavailable.find(s => s.id === 'amboy')?.reason).toBe('No production terrain pack');
    expect(result.sites.some(s => s.id.startsWith('amboy'))).toBe(false);
    expect(result.sites.filter(s => s.analogOf).every(s => s.name?.includes('proposed analog'))).toBe(true);
  });
});
