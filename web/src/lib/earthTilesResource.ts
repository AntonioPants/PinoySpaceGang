import type { WebGLRenderer } from 'three';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DisposableCesiumIonAuthPlugin } from './cesiumIonAuth';
import { createTerrainDecoder } from './terrainDecoder';

function createResource() {
  const tiles = new TilesRenderer();
  tiles.lruCache.minBytesSize = 128 * 1024 * 1024;
  tiles.lruCache.maxBytesSize = 256 * 1024 * 1024;
  tiles.errorTarget = 20;
  tiles.downloadQueue.maxJobs = 12;
  tiles.parseQueue.maxJobs = 4;
  tiles.registerPlugin(new DisposableCesiumIonAuthPlugin({
    apiToken: import.meta.env.VITE_CESIUM_ION_TOKEN,
    assetId: '2275207',
    autoRefreshToken: true,
  }));
  const decoder = createTerrainDecoder();
  tiles.manager.addHandler(/\.(gltf|glb)$/i, new GLTFLoader(tiles.manager).setDRACOLoader(decoder));
  return {
    tiles,
    references: 0,
    disposal: undefined as ReturnType<typeof setTimeout> | undefined,
    dispose() { tiles.dispose(); decoder.dispose(); },
  };
}

const resources = new WeakMap<WebGLRenderer, ReturnType<typeof createResource>>();

/** Retain one tile hierarchy and Google session while the opening changes sites. */
export function acquireEarthTiles(renderer: WebGLRenderer, reuse: boolean) {
  let resource = reuse ? resources.get(renderer) : undefined;
  if (!resource) {
    resource = createResource();
    if (reuse) resources.set(renderer, resource);
  }
  const retained = resource;
  clearTimeout(retained.disposal);
  retained.references++;
  let released = false;
  return {
    tiles: retained.tiles,
    release() {
      if (released) return;
      released = true;
      retained.references--;
      if (retained.references) return;
      const dispose = () => {
        retained.dispose();
        if (reuse) resources.delete(renderer);
      };
      // A site replacement releases and reacquires in the same React effect.
      // An unmount with no replacement releases all network and decoder resources.
      if (reuse) retained.disposal = setTimeout(dispose, 0);
      else dispose();
    },
  };
}
