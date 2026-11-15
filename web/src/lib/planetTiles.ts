import * as T from 'three';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { DisposableCesiumIonAuthPlugin as CesiumIonAuthPlugin } from './cesiumIonAuth';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import decoder from 'three/examples/jsm/libs/draco/gltf/draco_decoder.js?url';

/** The same measured, textured world from the three-world reveal through region selection.
 * Lives in WorldScene's renderer: there is no second globe to swap in after zooming. */
export function createPlanetTiles(body: 'Moon' | 'Mars', radius: number, renderer: T.WebGLRenderer) {
  // Keep the scene attachment stable while retrying only the failed world. A fresh
  // renderer also clears a rejected ion endpoint promise retained by the plugin.
  const group = new T.Group();
  let attempt = createPlanetTileAttempt(body, radius, renderer), retries = 0;
  let retryAt: number | null = null, disposed = false;
  group.add(attempt.group);
  return {
    group,
    credits: () => attempt.credits(),
    get ready() { return !disposed && attempt.ready; },
    get failed() { return !disposed && attempt.failed && retries >= 2; },
    update(cameras: T.PerspectiveCamera[]) {
      if (disposed) return;
      if (attempt.failed) {
        if (retries >= 2) return;
        retryAt ??= performance.now() + (retries === 0 ? 1000 : 3000);
        if (performance.now() < retryAt) return;
        attempt.group.removeFromParent(); attempt.dispose();
        attempt = createPlanetTileAttempt(body, radius, renderer);
        group.add(attempt.group); retries++; retryAt = null;
      }
      attempt.update(cameras);
    },
    dispose() { disposed = true; attempt.dispose(); group.clear(); },
  };
}

function createPlanetTileAttempt(body: 'Moon' | 'Mars', radius: number, renderer: T.WebGLRenderer) {
  const tiles = new TilesRenderer();
  tiles.registerPlugin(new CesiumIonAuthPlugin({apiToken:import.meta.env.VITE_CESIUM_ION_TOKEN,assetId:body==='Moon'?'2684829':'3644333',autoRefreshToken:true}));
  const draco=new DRACOLoader(); draco.setDecoderConfig({type:'js'});
  draco.manager.setURLModifier(url=>url.endsWith('draco_decoder.js')?decoder:url);
  tiles.manager.addHandler(/\.(gltf|glb)$/i,new GLTFLoader(tiles.manager).setDRACOLoader(draco));
  // ECEF (X at 0° longitude, Z north) -> the game's X/east, Y/north, -Z/east frame.
  tiles.group.rotation.x=-Math.PI/2;
  tiles.group.scale.setScalar(radius/(body==='Moon'?1737400:3396190));
  tiles.errorTarget=3;
  // Keep the current overview and region in memory; do not evict them on a camera switch.
  // Downloads remain bounded, rather than attempting to cache an entire planet at all LODs.
  tiles.lruCache.minBytesSize=48*1024*1024; tiles.lruCache.maxBytesSize=64*1024*1024;
  tiles.downloadQueue.maxJobs=6;tiles.parseQueue.maxJobs=2;
  let visible=0, stable=0, failed=false, prepared=false;
  tiles.addEventListener('tile-visibility-change',e=>{visible+=e.visible?1:-1;stable=0;});
  // Once the overview is ready, a missing refinement tile must not tear down the
  // visible world or send the player back to the title screen.
  tiles.addEventListener('load-error',()=>{if(!prepared)failed=true;});
  return {
    group:tiles.group,
    credits(){return tiles.getAttributions().map(a=>a.type==='string'?a.value:new DOMParser().parseFromString(a.value,'text/html').body.textContent??'').filter(Boolean).join(' · ');},
    get ready(){return prepared;},
    get failed(){return failed;},
    update(cameras:T.PerspectiveCamera[]) {
      for(const camera of cameras){camera.updateMatrixWorld();if(!tiles.hasCamera(camera))tiles.setCamera(camera);tiles.setResolutionFromRenderer(camera,renderer);}
      tiles.group.updateMatrixWorld(true);tiles.update();
      if(visible>0&&tiles.loadProgress>=1)stable++;else stable=0;
      if(visible>0&&stable>=8&&!failed)prepared=true;
    },
    dispose(){tiles.dispose();draco.dispose();},
  };
}
