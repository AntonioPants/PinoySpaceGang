import { LoadingManager } from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import js from 'three/examples/jsm/libs/draco/gltf/draco_decoder.js?url';
import wasm from 'three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url';
import wrapper from 'three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url';

export function createTerrainDecoder() {
  const assets: Record<string, string> = {
    'draco_decoder.js': js,
    'draco_decoder.wasm': wasm,
    'draco_wasm_wrapper.js': wrapper,
  };
  const manager = new LoadingManager();
  manager.setURLModifier(url => assets[url] ?? url);
  return new DRACOLoader(manager);
}
