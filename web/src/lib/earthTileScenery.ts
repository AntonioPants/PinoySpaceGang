import * as T from 'three';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { CesiumIonAuthPlugin } from '3d-tiles-renderer/three/plugins';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { polygonGeometry, polygonTilePlugin } from './polygonTerrain';
import type { EnvLook } from '../components/cutscene/presets';
import { terrainSurroundings } from './terrainSurroundings';
import decoder from 'three/examples/jsm/libs/draco/gltf/draco_decoder.js?url';

export interface EarthScenery {
  draw(camera: T.PerspectiveCamera, fog?: T.Fog): boolean;
  dispose(): void;
}

/** Render the streamed world first. Keep a separate depth buffer pass for the
 * measured foreground so a photogrammetry/DEM height difference cannot bury it. */
export function createEarthScenery(renderer: T.WebGLRenderer, host: HTMLElement,
  lat: number, lon: number, height: number, localToWorld: T.Matrix4,
  ground: T.BufferGeometry, bounds: { west: number; east: number; north: number; south: number },
  sky: T.Color, meshes: T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[], look?: EnvLook): EarthScenery {
  const polygon = !!look;
  const tiles = new TilesRenderer();
  tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: import.meta.env.VITE_CESIUM_ION_TOKEN, assetId: '2275207', autoRefreshToken: true }));
  const draco = new DRACOLoader(new T.LoadingManager());
  draco.setDecoderConfig({ type: 'js' });
  draco.manager.setURLModifier(url => url.endsWith('draco_decoder.js') ? decoder : url);
  tiles.manager.addHandler(/\.(gltf|glb)$/i, new GLTFLoader(tiles.manager).setDRACOLoader(draco));
  const origin = tiles.ellipsoid.getEastNorthUpFrame(lat * Math.PI / 180, lon * Math.PI / 180, height, new T.Matrix4()).multiply(new T.Matrix4().makeRotationX(Math.PI / 2));
  tiles.group.matrixAutoUpdate = false;
  tiles.group.matrix.copy(localToWorld).multiply(origin.invert());
  const world = new T.Scene();
  world.background = sky;
  world.add(tiles.group, polygon ? new T.HemisphereLight(look!.stars ? 0x222230 : look!.skyHorizon,look!.groundDark,look!.stars ? .25 : .95) : new T.AmbientLight(0xffffff, 2));
  const restoreGeometry = polygon ? meshes.map(mesh => ({ mesh, geometry:mesh.geometry.clone() })) : [];
  if (polygon) {
    tiles.registerPlugin(polygonTilePlugin(origin,look!));
    for (const mesh of meshes) polygonGeometry(mesh.geometry);
    // The footprint filter below uses an index even for independent triangles.
    ground.setIndex(Array.from({length:ground.getAttribute('position').count},(_,i)=>i));
    const sun = new T.DirectionalLight(look!.sun, 2.4);
    sun.position.set(-5500,4200,-7200).applyMatrix4(localToWorld);
    world.add(sun);
  }
  const surroundings = look ? terrainSurroundings(ground,bounds,localToWorld,tiles.group,look) : undefined;
  if (surroundings) world.add(surroundings.mesh);
  const full = ground.index!;
  const positions = ground.getAttribute('position');
  const inside = (i: number) => positions.getX(i) >= bounds.west && positions.getX(i) <= bounds.east &&
    positions.getZ(i) >= bounds.north && positions.getZ(i) <= bounds.south;
  const indices = [];
  for (let i = 0; i < full.count; i += 3) {
    const a = full.getX(i), b = full.getX(i+1), c = full.getX(i+2);
    if (inside(a) && inside(b) && inside(c)) indices.push(a,b,c);
  }
  const footprint = new T.Uint32BufferAttribute(indices, 1);
  const credit = document.createElement('small');
  credit.style.cssText = 'position:absolute;right:1%;top:15%;max-width:55%;background:#151515bc;color:white;padding:2px 5px;pointer-events:none;font:10px sans-serif';
  host.append(credit); credit.hidden = true;
  // Project the same visible imagery straight down onto the measured grid.
  const imageryResolution = polygon ? 1 : 1536;
  const target = new T.WebGLRenderTarget(imageryResolution, imageryResolution);
  const width = bounds.east - bounds.west, depth = bounds.south - bounds.north;
  const overhead = new T.OrthographicCamera(-width/2, width/2, depth/2, -depth/2, 1, 100000);
  const scale = new T.Vector3().setFromMatrixScale(localToWorld).x;
  overhead.left *= scale; overhead.right *= scale; overhead.top *= scale; overhead.bottom *= scale;
  overhead.near *= scale; overhead.far *= scale; overhead.updateProjectionMatrix();
  overhead.position.set((bounds.east+bounds.west)/2, 50000, (bounds.north+bounds.south)/2).applyMatrix4(localToWorld);
  overhead.quaternion.setFromRotationMatrix(new T.Matrix4().extractRotation(localToWorld));
  overhead.rotateX(-Math.PI/2);
  overhead.updateMatrixWorld();
  if (polygon) {
    overhead.left=-60000; overhead.right=60000; overhead.top=60000; overhead.bottom=-60000;
    overhead.updateProjectionMatrix();
  }
  tiles.setCamera(overhead);
  tiles.setResolution(overhead,polygon ? 512 : target.width,polygon ? 512 : target.height);
  const surfaces = meshes.map(({ geometry, material }) => {
    const pos = geometry.getAttribute('position'), uv = new Float32Array(pos.count*2);
    for (let i=0;i<pos.count;i++) {
      uv[i*2] = (pos.getX(i)-bounds.west)/width;
      uv[i*2+1] = (bounds.south-pos.getZ(i))/depth;
    }
    return { geometry, material, flatShading:material.flatShading, vertexColors:material.vertexColors, uv: new T.BufferAttribute(uv,2), originalUV:geometry.getAttribute('uv'), originalMap:material.map, color:material.color.clone(), emissive:material.emissive.clone(), emissiveMap:material.emissiveMap };
  });
  function applyImagery(active: boolean) {
    if (polygon) return;
    for (const s of surfaces) {
      if (active) s.geometry.setAttribute('uv',s.uv);
      else if (s.originalUV) s.geometry.setAttribute('uv',s.originalUV);
      else s.geometry.deleteAttribute('uv');
      s.material.flatShading = active && polygon ? true : s.flatShading;
      s.material.vertexColors = active && polygon ? false : s.vertexColors;
      s.material.map = active ? (polygon ? target.texture : null) : s.originalMap;
      s.material.color.copy(s.color);
      s.material.emissive.copy(s.emissive);
      if (active && !polygon) {
        // Aerial imagery already includes sunlight and shadows.
        s.material.color.set(0);
        s.material.emissive.set(0xffffff);
      }
      s.material.emissiveMap = active && !polygon ? target.texture : s.emissiveMap;
      s.material.needsUpdate = true;
    }
  }
  let visible = 0, dirty = true;
  tiles.addEventListener('tile-visibility-change', e => { visible += e.visible ? 1 : -1; dirty = true; surroundings?.refresh(); });
  return {
    draw(camera, fog) {
      camera.updateMatrixWorld(); world.updateMatrixWorld();
      if (!tiles.hasCamera(camera)) tiles.setCamera(camera);
      tiles.setResolutionFromRenderer(camera, renderer); tiles.update();
      if (dirty) {
        dirty = false;
        if (visible && !polygon) {
          const previous = renderer.getRenderTarget();
          renderer.setRenderTarget(target);
          renderer.render(world, overhead);
          renderer.setRenderTarget(previous);
        }
        applyImagery(visible > 0);
        ground.setIndex(visible ? footprint : full);
        credit.hidden = !visible;
        credit.textContent = ['Google Maps · Cesium ion', ...tiles.getAttributions().filter(a => a.type === 'string').map(a => a.value)].join(' · ');
      }
      if (!visible) return false;
      surroundings?.update();
      world.fog = fog ?? null;
      renderer.render(world, camera);
      renderer.clearDepth();
      return true;
    },
    dispose() { applyImagery(false); target.dispose(); surroundings?.dispose(); ground.setIndex(full); tiles.dispose(); restoreGeometry.forEach(({mesh,geometry}) => { mesh.geometry.copy(geometry); geometry.dispose(); }); draco.dispose(); credit.remove(); },
  };
}
