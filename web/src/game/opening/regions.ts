import * as T from 'three';
import { globePoint } from './earthSurface';

export type RegionState = 'idle' | 'hover' | 'selected';

/**
 * A site's study area drawn on its globe: a north-up square (the catalog's footprints are
 * square local study areas) laid on the sphere, with a filled interior and a brighter rim.
 * Real footprints are a few kilometres across, far below a pixel from orbit, so the square
 * is drawn `halfAngleDeg` wide to be seen and selected. It marks where, not how large.
 * The group is centred on the globe's centre: add it at the planet's position.
 */
export function regionPatch(id: string, lat: number, lon: number, radius: number, halfAngleDeg: number): T.Group {
  const up = globePoint(lat, lon, 1), east = globePoint(0, lon + 90, 1), north = new T.Vector3().crossVectors(up, east);
  const reach = Math.tan(T.MathUtils.degToRad(halfAngleDeg));
  // u east, v north in [-1, 1]; lifted just clear of the surface.
  const point = (u: number, v: number, lift: number) => up.clone().addScaledVector(east, u * reach).addScaledVector(north, v * reach).normalize().multiplyScalar(radius * lift);
  const N = 6, fill: number[] = [], fillIndex: number[] = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    fill.push(...point(i / N * 2 - 1, j / N * 2 - 1, 1.006).toArray());
    if (i < N && j < N) { const a = j * (N + 1) + i; fillIndex.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1); }
  }
  // The rim: a band between the outline and a slightly smaller copy of it.
  const rim: number[] = [], rimIndex: number[] = [], outline: [number, number][] = [];
  for (let i = 0; i < N; i++) outline.push([i / N * 2 - 1, -1]);
  for (let i = 0; i < N; i++) outline.push([1, i / N * 2 - 1]);
  for (let i = 0; i < N; i++) outline.push([1 - i / N * 2, 1]);
  for (let i = 0; i < N; i++) outline.push([-1, 1 - i / N * 2]);
  outline.forEach(([u, v], k) => {
    rim.push(...point(u, v, 1.008).toArray(), ...point(u * .9, v * .9, 1.008).toArray());
    const a = k * 2, b = ((k + 1) % outline.length) * 2;
    rimIndex.push(a, b, a + 1, b, b + 1, a + 1);
  });
  const mesh = (positions: number[], index: number[]) => {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(index);
    const made = new T.Mesh(geometry, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide }));
    made.userData.id = id; return made;
  };
  const group = new T.Group(); group.userData.id = id;
  group.add(mesh(fill, fillIndex), mesh(rim, rimIndex));
  paintRegion(group, 'idle');
  return group;
}

const LOOK: Record<RegionState, { fill: number; fillOpacity: number; rim: number; rimOpacity: number; lift: number }> = {
  idle: { fill: 0xffffff, fillOpacity: .1, rim: 0xffffff, rimOpacity: .7, lift: 1 },
  hover: { fill: 0xf1d8a8, fillOpacity: .42, rim: 0xfff1cf, rimOpacity: 1, lift: 1.012 },
  selected: { fill: 0xdfc28d, fillOpacity: .26, rim: 0xe9c78a, rimOpacity: 1, lift: 1.004 },
};

/** Idle regions are quiet white outlines; the hovered one fills gold and lifts; the selected one stays gold. */
export function paintRegion(group: T.Object3D, state: RegionState) {
  const look = LOOK[state], [fill, rim] = group.children as T.Mesh[];
  const fillMaterial = fill.material as T.MeshBasicMaterial, rimMaterial = rim.material as T.MeshBasicMaterial;
  fillMaterial.color.setHex(look.fill); fillMaterial.opacity = look.fillOpacity;
  rimMaterial.color.setHex(look.rim); rimMaterial.opacity = look.rimOpacity;
  group.scale.setScalar(look.lift); group.renderOrder = state === 'idle' ? 1 : 2;
}
