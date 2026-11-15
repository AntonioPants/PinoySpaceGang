import * as THREE from 'three';
import { loadCatalog } from './catalog';
import { createEarthScenery } from './earthTileScenery';
import type { CutsceneEngine } from '../components/cutscene/engine';
import { simToPack, type TerrainPack } from '../components/cutscene/terrainPack';

export function attachSiteScenery(scene: CutsceneEngine, host: HTMLElement, pack: TerrainPack,
  target: { x: number; y: number }, verticalOffsetM: number) {
  if (import.meta.env.VITE_CESIUM_ION_TOKEN) void loadCatalog().then(catalog => {
    const site = catalog.analogs.find(a => a.id === pack.manifest.id);
    if (!site) return;
    const landing = simToPack(pack, target);
    const { rows, columns, spacing_m } = pack.manifest.grid;
    const width = (columns-1)*spacing_m, depth = (rows-1)*spacing_m;
    const frame = new THREE.Matrix4().makeTranslation(-target.x, 0, target.y);
    const height = verticalOffsetM + (pack.heightAt(landing.x, landing.z) ?? 0);
    scene.attachEarthScenery((renderer, ground, meshes, look) => createEarthScenery(renderer, host, site.lat, site.lon,
      height, frame, ground, {west:-landing.x,east:width-landing.x,north:-landing.z,south:depth-landing.z},
      new THREE.Color(0xb9cad3), meshes, look));
  }).catch(() => { /* The measured scene is available offline. */ });
}
