import { afterEach, expect, it, vi } from 'vitest';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { DisposableCesiumIonAuthPlugin } from './cesiumIonAuth';

afterEach(() => vi.unstubAllGlobals());

it('does not request a tileset after disposal during endpoint authentication', async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal('fetch', fetch);
  const tiles = new TilesRenderer();
  const plugin = new DisposableCesiumIonAuthPlugin({ apiToken: 'test', assetId: '2684829' });
  tiles.registerPlugin(plugin);
  const pending = (plugin as unknown as { loadRootTileSet(): Promise<unknown> }).loadRootTileSet();
  tiles.dispose();
  resolve(Response.json({ type: '3DTILES', url: 'https://example.com/tileset.json', accessToken: 'temporary' }));
  await pending;
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('keeps Authorization on an active renderer’s root request', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(Response.json({ type: '3DTILES', url: 'https://example.com/tileset.json', accessToken: 'temporary' }))
    .mockResolvedValueOnce(Response.json({ asset: { version: '1.0' }, geometricError: 0, root: { boundingVolume: { sphere: [0, 0, 0, 1] }, geometricError: 0 } }));
  vi.stubGlobal('fetch', fetch);
  const tiles = new TilesRenderer();
  const plugin = new DisposableCesiumIonAuthPlugin({ apiToken: 'test', assetId: '2684829' });
  tiles.registerPlugin(plugin);
  await (plugin as unknown as { loadRootTileSet(): Promise<unknown> }).loadRootTileSet();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer temporary');
  tiles.dispose();
});
