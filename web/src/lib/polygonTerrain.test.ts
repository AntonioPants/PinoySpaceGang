import { expect, it } from 'vitest';
import * as T from 'three';
import { polygonTilePlugin } from './polygonTerrain';
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
