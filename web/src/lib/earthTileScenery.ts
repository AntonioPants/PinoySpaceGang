import * as T from 'three';
import { TilesRenderer } from '3d-tiles-renderer/three';
import { DisposableCesiumIonAuthPlugin as CesiumIonAuthPlugin } from './cesiumIonAuth';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { polygonGeometry, polygonTilePlugin, streamedGap } from './polygonTerrain';
import type { EnvLook } from '../components/cutscene/presets';
import { terrainSurroundings } from './terrainSurroundings';
import decoder from 'three/examples/jsm/libs/draco/gltf/draco_decoder.js?url';

export interface EarthScenery {
  readonly ready: boolean;
  readonly failed: boolean;
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
  tiles.lruCache.minBytesSize=64*1024*1024;tiles.lruCache.maxBytesSize=96*1024*1024;
  tiles.downloadQueue.maxJobs=6;tiles.parseQueue.maxJobs=2;
  tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: import.meta.env.VITE_CESIUM_ION_TOKEN, assetId: '2275207', autoRefreshToken: true }));
  const draco = new DRACOLoader(new T.LoadingManager());
  draco.setDecoderConfig({ type: 'js' });
  draco.manager.setURLModifier(url => url.endsWith('draco_decoder.js') ? decoder : url);
  tiles.manager.addHandler(/\.(gltf|glb)$/i, new GLTFLoader(tiles.manager).setDRACOLoader(draco));
  const origin = tiles.ellipsoid.getEastNorthUpFrame(lat * Math.PI / 180, lon * Math.PI / 180, height, new T.Matrix4()).multiply(new T.Matrix4().makeRotationX(Math.PI / 2));
  origin.invert();                       // ECEF -> local east/up/south
  // `height` is a sea-level (EGM2008) height, but 3D Tiles sit on the WGS84 ellipsoid. The gap (the
  // geoid undulation, e.g. about +30 m in New Zealand, +65 m in Iceland, -25 m in New Mexico) would
  // otherwise float the streamed ground above the measured terrain and the camera. `lift` removes
  // it, measured against the DEM once tiles arrive (see calibrate()).
  let lift = 0;
  const placeTiles = () => { tiles.group.matrix.copy(localToWorld).multiply(new T.Matrix4().makeTranslation(0, lift, 0)).multiply(origin); };
  tiles.group.matrixAutoUpdate = false;
  placeTiles();
  const world = new T.Scene();
  world.background = sky;
  world.add(tiles.group, polygon ? new T.HemisphereLight(look!.stars ? 0x222230 : look!.skyHorizon,look!.groundDark,look!.stars ? .25 : .95) : new T.AmbientLight(0xffffff, 2));
  const restoreGeometry = polygon ? meshes.map(mesh => ({ mesh, geometry:mesh.geometry.clone() })) : [];
  // Flight meshes and bounds are already relative to the landing point. Only
  // the streamed site's origin needs the off-centre target translation.
  const groundFrame = polygon ? new T.Matrix4() : localToWorld;
  const previousClipping = renderer.localClippingEnabled;
  if (polygon) {
    // Clip fragments, so even a coarse tile spanning the entire DEM has a
    // clean opening. Raycasts still see the tiles for height calibration.
    const footprintPlanes = [
      new T.Plane(new T.Vector3(-1, 0, 0), bounds.west),
      new T.Plane(new T.Vector3(1, 0, 0), -bounds.east),
      new T.Plane(new T.Vector3(0, 0, -1), bounds.north),
      new T.Plane(new T.Vector3(0, 0, 1), -bounds.south),
    ];
    renderer.localClippingEnabled = true;
    tiles.registerPlugin(polygonTilePlugin(origin,look!,footprintPlanes));
    for (const mesh of meshes) polygonGeometry(mesh.geometry);
    // The footprint filter below uses an index even for independent triangles.
    ground.setIndex(Array.from({length:ground.getAttribute('position').count},(_,i)=>i));
    const sun = new T.DirectionalLight(look!.sun, 2.4);
    sun.position.set(-5500,4200,-7200).applyMatrix4(localToWorld);
    world.add(sun);
  }
  const surroundings = look ? terrainSurroundings(ground,bounds,groundFrame,tiles.group,look) : undefined;
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
  // DEM points to compare the streamed surface with: an even spread of the measured vertices.
  const probes: T.Vector3[] = [];
  {
    const all: number[] = [];
    for (let i = 0; i < positions.count; i++) if (inside(i)) all.push(i);
    const step = Math.max(1, Math.floor(all.length / 49));
    for (let k = Math.floor(step / 2); k < all.length && probes.length < 49; k += step) {
      const i = all[k]; probes.push(new T.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i)));
    }
  }
  const probeRay = new T.Raycaster(), toLocal = groundFrame.clone().invert(), down = new T.Vector3(0, -1, 0).transformDirection(groundFrame);
  /** Moves the streamed world vertically onto the measured terrain. True if it moved. */
  function calibrate() {
    tiles.group.updateMatrixWorld(true);
    // gaps without the current lift, i.e. how far the raw tiles sit above the DEM
    const gaps: number[] = [], top = new T.Vector3();
    for (const p of probes) {
      top.set(p.x, 60000, p.z).applyMatrix4(groundFrame);
      probeRay.set(top, down);
      const hit = probeRay.intersectObject(tiles.group, true)[0];
      if (hit) gaps.push(hit.point.applyMatrix4(toLocal).y - p.y - lift);
    }
    const gap = streamedGap(gaps, probes.length);
    if (gap === null || Math.abs(-gap - lift) < 2) return false;      // finer tiles shift the median by ~1 m
    lift = -gap; placeTiles(); return true;
  }
  let lastCalibration = -Infinity, calibrationPending = true;
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
  // Once a flight's horizon has converged, retain this exact rendered tile set. Refining
  // a distant ridge in front of the player is more distracting than a fixed detail level.
  let settledFrames = 0, ready = false, failed = false;
  tiles.addEventListener('load-error', () => { failed = true; });
  let visible = 0, dirty = true;
  tiles.addEventListener('tile-visibility-change', e => { visible += e.visible ? 1 : -1; dirty = true; calibrationPending = true; surroundings?.refresh(); });
  return {
    get ready() { return ready; },
    get failed() { return failed; },
    draw(camera, fog) {
      camera.updateMatrixWorld(); world.updateMatrixWorld();
      if (!tiles.hasCamera(camera)) tiles.setCamera(camera);
      tiles.setResolutionFromRenderer(camera, renderer);
      if (!polygon || !ready) tiles.update();
      if (visible > 0 && tiles.loadProgress >= 1) settledFrames++; else settledFrames = 0;
      if (settledFrames >= 12 && (!surroundings || surroundings.ready)) ready = true;
      // Re-measure as finer tiles stream in, at most once a second.
      const now = performance.now();
      if (visible && calibrationPending && now - lastCalibration > 1000) {
        lastCalibration = now; calibrationPending = false;
        if (calibrate()) { dirty = true; surroundings?.refresh(); world.updateMatrixWorld(); }
      }
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
    dispose() { if (polygon) renderer.localClippingEnabled = previousClipping; applyImagery(false); target.dispose(); surroundings?.dispose(); ground.setIndex(full); tiles.dispose(); restoreGeometry.forEach(({mesh,geometry}) => { mesh.geometry.copy(geometry); geometry.dispose(); }); draco.dispose(); credit.remove(); },
  };
}
