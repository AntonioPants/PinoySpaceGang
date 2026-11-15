import * as T from 'three';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { CesiumIonAuthPlugin } from '3d-tiles-renderer/three/plugins';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import decoder from 'three/examples/jsm/libs/draco/gltf/draco_decoder.js?url';

/** The same measured, textured world from the three-world reveal through region selection.
 * Lives in WorldScene's renderer: there is no second globe to swap in after zooming. */
export function createPlanetTiles(body: 'Moon' | 'Mars', radius: number, renderer: T.WebGLRenderer) {
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
  let visible=0, stable=0, failed=false;
  tiles.addEventListener('tile-visibility-change',e=>{visible+=e.visible?1:-1;stable=0;});
  tiles.addEventListener('load-error',()=>{failed=true;});
  return {
    group:tiles.group,
    credits(){return tiles.getAttributions().map(a=>a.type==='string'?a.value:new DOMParser().parseFromString(a.value,'text/html').body.textContent??'').filter(Boolean).join(' · ');},
    get ready(){return visible>0&&stable>=8&&!failed;},
    get failed(){return failed;},
    update(cameras:T.PerspectiveCamera[]) {
      for(const camera of cameras){camera.updateMatrixWorld();if(!tiles.hasCamera(camera))tiles.setCamera(camera);tiles.setResolutionFromRenderer(camera,renderer);}
      tiles.group.updateMatrixWorld(true);tiles.update();
      if(visible>0&&tiles.loadProgress>=1)stable++;else stable=0;
    },
    dispose(){tiles.dispose();draco.dispose();},
  };
}
