import * as T from 'three';
import { globePoint } from './earthSurface';

export type RegionState = 'idle' | 'hover' | 'selected';

/**
 * A site on its globe: a round dot that looks like the detailed Cesium globe's site dots (a light
 * centre, a dark ring and a thin light edge), so the marker does not change shape when the detailed
 * globe fades in over this one. Real study areas are a few kilometres across, far below a pixel from
 * orbit, so the dot is drawn `halfAngleDeg` wide to be seen and selected: it marks where, not how large.
 * The returned group is centred on the globe's centre: add it at the planet's position.
 */
export function regionPatch(id: string, lat: number, lon: number, radius: number, halfAngleDeg: number): T.Group {
  const up = globePoint(lat, lon, 1), east = globePoint(0, lon + 90, 1), north = new T.Vector3().crossVectors(up, east);
  const reach = Math.tan(T.MathUtils.degToRad(halfAngleDeg)), lift = 1.006;
  // The dot's centre on the surface; its discs are laid on the sphere and stored relative to that centre,
  // so scaling the dot (hover, selection) swells it in place.
  const middle = up.clone().multiplyScalar(radius * lift);
  const disc = (share: number, rise: number) => {
    const flat = new T.CircleGeometry(share, 40), p = flat.getAttribute('position'), v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.copy(up).addScaledVector(east, p.getX(i) * reach).addScaledVector(north, p.getY(i) * reach).normalize().multiplyScalar(radius * (lift + rise)).sub(middle);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    flat.computeBoundingSphere();
    return flat;
  };
  const layer = (geometry: T.BufferGeometry, order: number) => {
    const made = new T.Mesh(geometry, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide }));
    made.userData.id = id; made.renderOrder = order; return made;
  };
  const dot = new T.Group();
  dot.add(
    layer(disc(1, 0), 0),             // the light edge, and the hover / selected glow
    layer(disc(.86, .0004), 1),       // the dark ring
    layer(disc(.55, .0008), 2),       // the centre
  );
  dot.position.copy(middle);
  dot.userData.id = id;
  const group = new T.Group(); group.userData.id = id; group.add(dot);
  paintRegion(group, 'idle');
  return group;
}

const LOOK: Record<RegionState, { edge: number; edgeOpacity: number; ring: number; centre: number; scale: number }> = {
  idle: { edge: 0xffffff, edgeOpacity: .9, ring: 0x171717, centre: 0xffffff, scale: 1 },
  hover: { edge: 0xfff1cf, edgeOpacity: 1, ring: 0x171717, centre: 0xf1d8a8, scale: 1.4 },
  selected: { edge: 0xe7c889, edgeOpacity: 1, ring: 0x171717, centre: 0xe7c889, scale: 1.3 },
};
/** Idle discovered scan windows have a cyan centre, so they read apart from curated sites at a glance. */
const DISCOVERED = { ...LOOK.idle, edge: 0x65d6d1, centre: 0x65d6d1 };

/** Idle sites are white dots; the hovered one swells and turns pale gold; the selected one is gold. */
export function paintRegion(group: T.Object3D, state: RegionState) {
  const look = state === 'idle' && String(group.userData.id ?? '').startsWith('scan-') ? DISCOVERED : LOOK[state];
  const dot = group.children[0] as T.Group, [edge, ring, centre] = dot.children as T.Mesh[];
  const paint = (mesh: T.Mesh, colour: number, opacity = 1) => { const m = mesh.material as T.MeshBasicMaterial; m.color.setHex(colour); m.opacity = opacity; };
  paint(edge, look.edge, look.edgeOpacity); paint(ring, look.ring, .95); paint(centre, look.centre);
  dot.scale.setScalar(look.scale);
  group.renderOrder = state === 'idle' ? 1 : 2;
  dot.children.forEach((mesh, i) => { mesh.renderOrder = (state === 'idle' ? 10 : 20) + i; });
}
