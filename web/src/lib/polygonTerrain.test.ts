import { expect, it } from 'vitest';
import * as T from 'three';
import { polygonTilePlugin, streamedGap } from './polygonTerrain';
import { PRESETS } from '../components/cutscene/presets';

it('preserves streamed mountain and valley vertices when applying the polygon style', () => {
  const geometry = new T.BufferGeometry();
  const positions = [0,800,0, 500,2400,0, 1000,300,500];
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setIndex([0,1,2]);
  const material = new T.MeshBasicMaterial();
  const mesh=new T.Mesh(geometry,material);
  const root=new T.Group(); root.add(mesh);
  polygonTilePlugin(new T.Matrix4(),PRESETS.crater).processTileModel(root);
  expect(Array.from(geometry.getAttribute('position').array)).toEqual(positions);
  expect(geometry.index).toBeNull();
  expect(geometry.getAttribute('color').count).toBe(3);
  expect((mesh.material as unknown as T.MeshStandardMaterial).flatShading).toBe(true);
  geometry.dispose(); mesh.material.dispose();
});

it('measures how far streamed tiles float above the measured terrain', () => {
  // ~28 m geoid gap with a few trees and a coarse-tile outlier
  expect(streamedGap([28, 27.5, 28.4, 41, 27.9, 28.1, -3])).toBeCloseTo(28.0, 5);
  expect(streamedGap([-25, -24.6, -25.3, -24.9, -25.1, -24.8])).toBeCloseTo(-24.95, 5);
  expect(streamedGap([28, 28, NaN, 28])).toBeNull();          // too few hits while tiles load
  // coarse root tiles kilometres off are ignored rather than moving the world
  expect(streamedGap([-18885, -18880, -18890, -18870, -18900, -18860])).toBeNull();
  expect(streamedGap([24, 23.8, 24.1, -18885, 23.9, 24.2, 24], 7)).toBeCloseTo(24, 5);
  expect(streamedGap([24, 23.8, 24.1, 23.9, 24.2], 49)).toBeNull();   // most probes still missing
});
