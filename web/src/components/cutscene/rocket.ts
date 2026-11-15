import * as THREE from 'three';
import { bakeColoured } from './lander';
import { liveries, type LanderAppearance } from '../../lib/landerAppearance';

/**
 * Illustrative launch vehicle that carries the player's lander: a core stage with four strap-on
 * boosters, an upper stage and a two-piece payload fairing. It is painted in the lander's livery.
 * Rocket frame: metres, origin at the bottom of the engine bells, +Y up. The lander's foot plane
 * sits on the payload adapter at PAYLOAD_Y, inside the fairing.
 */
export const PAYLOAD_Y = 32;
export const ROCKET_HEIGHT = 46;

export interface Nozzle { part: THREE.Object3D; at: THREE.Vector3; size: number; flame: THREE.Mesh }
export interface FairingHalf { pivot: THREE.Group; axis: THREE.Vector3; out: THREE.Vector3 }
export interface Rocket {
  group: THREE.Group;
  core: THREE.Group;            // core stage, upper stage and payload adapter
  boosters: THREE.Group[];      // strap-on thrusters, dropped first
  fairing: FairingHalf[];       // clamshell halves, hinged at their base
  coreNozzle: Nozzle;
  boosterNozzles: Nozzle[];
  /** 0 = fairing closed, 1 = halves swung open on their hinges. */
  setFairing(open: number): void;
  /** Puts every separated part back on the stack, closed and in its original place. */
  reset(): void;
}

const FAIRING_R = 3.15, CORE_R = 2, BOOSTER_R = .8, BOOSTER_D = CORE_R + BOOSTER_R + .12;
const FAIRING_BASE = 30.6, FAIRING_OPEN = .62;      // m, rad

/** Engine bell outline (radius, height) for a bell `scale` times the core engine size. */
const bell = (scale: number, y0: number) => [[.4, 1.7], [.47, 1.42], [.58, .95], [.71, .38], [.76, 0]]
  .map(([r, y]) => new THREE.Vector2(r * scale, y0 + y * scale));

function flameMesh(radius: number, length: number) {
  const flame = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 16, 1, true), new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  flame.geometry.rotateX(Math.PI); flame.geometry.translate(0, -length / 2, 0); flame.visible = false;
  return flame;
}

export function buildRocket(spec: LanderAppearance = {}): Rocket {
  const colours = liveries.find(l => l.id === spec.liveryId) ?? liveries[0];
  const white = colours.shell, band = colours.hull, accent = colours.accent, dark = 0x23272d, metal = 0x8f969c;
  const paint = new Map<number, THREE.MeshStandardMaterial>();
  const tint = (c: number) => { let m = paint.get(c); if (!m) { m = new THREE.MeshStandardMaterial({ color: c }); paint.set(c, m); } return m; };
  const put = (parent: THREE.Object3D, geo: THREE.BufferGeometry, c: number, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, tint(c)); m.position.set(x, y, z); parent.add(m); return m;
  };
  const cyl = (parent: THREE.Object3D, top: number, bottom: number, h: number, c: number, y: number, x = 0, z = 0, seg = 32) =>
    put(parent, new THREE.CylinderGeometry(top, bottom, h, seg, 1, true), c, x, y, z);
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .35, roughness: .5, side: THREE.DoubleSide });
  const group = new THREE.Group();

  // ---- core stage, interstage, upper stage and payload adapter: one rigid part
  const core = new THREE.Group(); group.add(core);
  put(core, new THREE.LatheGeometry(bell(1.05, 0), 24), dark);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    put(core, new THREE.LatheGeometry(bell(.62, .25), 18), dark, Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25);
  }
  cyl(core, 1.95, 2.18, 1.7, dark, 2.4);
  put(core, new THREE.CircleGeometry(1.95, 32).rotateX(Math.PI / 2), dark, 0, 1.6, 0);   // heat shield under the tank
  cyl(core, CORE_R, CORE_R, 21, white, 13.75);
  for (const y of [5.2, 21.5]) cyl(core, CORE_R + .03, CORE_R + .03, .7, band, y);
  // livery stripes and the cable raceway sit between the boosters (which are at 0, 90, 180, 270 degrees)
  const between = (w: number, h: number, d: number, c: number, y: number, a: number, r: number) =>
    { put(core, new THREE.BoxGeometry(w, h, d), c, Math.cos(a) * r, y, Math.sin(a) * r).rotation.y = -a; };
  for (const a of [3 * Math.PI / 4, -3 * Math.PI / 4]) between(.06, 12, .8, band, 13.5, a, CORE_R + .02);
  between(.3, 22, .26, dark, 14, Math.PI / 4, CORE_R + .12);
  cyl(core, CORE_R, CORE_R, 1.6, dark, 25.05);
  cyl(core, CORE_R, CORE_R, 5.2, white, 28.45);
  cyl(core, CORE_R + .03, CORE_R + .03, .35, accent, 30.5);
  cyl(core, 1.2, CORE_R, 1.25, metal, PAYLOAD_Y - .62);
  put(core, new THREE.CircleGeometry(1.2, 32).rotateX(-Math.PI / 2), metal, 0, PAYLOAD_Y - .01, 0);
  bakeColoured(core, body);
  const coreNozzle: Nozzle = { part: core, at: new THREE.Vector3(0, .1, 0), size: 1.9, flame: flameMesh(2.1, 13) };
  core.add(coreNozzle.flame);

  // ---- strap-on boosters (the "thrusters" that drop off first); local +X points away from the core
  const boosters: THREE.Group[] = [], boosterNozzles: Nozzle[] = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, b = new THREE.Group();
    put(b, new THREE.LatheGeometry(bell(.72, 0), 18), dark);
    cyl(b, BOOSTER_R, .92, 1, dark, 1.6, 0, 0, 24);
    cyl(b, BOOSTER_R, BOOSTER_R, 15, white, 9.6, 0, 0, 24);
    for (const y of [4, 15.6]) cyl(b, BOOSTER_R + .03, BOOSTER_R + .03, .45, band, y, 0, 0, 24);
    const nose = [0, .2, .4, .6, .8, 1].map(u => new THREE.Vector2(Math.max(.04, BOOSTER_R * Math.cos(u * Math.PI / 2) ** .7), 17.1 + u * 3.4));
    put(b, new THREE.LatheGeometry(nose, 24), white);
    for (const y of [4, 15]) put(b, new THREE.BoxGeometry(.5, .3, .32), dark, -BOOSTER_R - .1, y, 0);
    bakeColoured(b, body);
    b.position.set(Math.cos(a) * BOOSTER_D, 0, Math.sin(a) * BOOSTER_D); b.rotation.y = -a;
    const nozzle: Nozzle = { part: b, at: new THREE.Vector3(0, .1, 0), size: .8, flame: flameMesh(.62, 8) };
    b.add(nozzle.flame); group.add(b); boosters.push(b); boosterNozzles.push(nozzle);
  }

  // ---- payload fairing: two halves of a hammerhead shell, each hinged at the outer edge of its base
  const shell = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .25, roughness: .45, side: THREE.DoubleSide });
  const outline = [new THREE.Vector2(CORE_R + .02, FAIRING_BASE), new THREE.Vector2(FAIRING_R, FAIRING_BASE + 1.2), new THREE.Vector2(FAIRING_R, 39.6)];
  for (let i = 1; i <= 8; i++) { const u = i / 8; outline.push(new THREE.Vector2(Math.max(.18, FAIRING_R * Math.cos(u * Math.PI / 2) ** .75), 39.6 + u * 6.2)); }
  const fairing: FairingHalf[] = [];
  for (const side of [1, -1]) {
    const out = new THREE.Vector3(side, 0, 0), hinge = new THREE.Vector3(side * (CORE_R + .02), FAIRING_BASE, 0);
    const pivot = new THREE.Group(), phi = side > 0 ? 0 : Math.PI;           // lathe: x = r sin(phi)
    put(pivot, new THREE.LatheGeometry(outline, 28, phi, Math.PI), white);
    put(pivot, new THREE.LatheGeometry([new THREE.Vector2(FAIRING_R + .02, 33), new THREE.Vector2(FAIRING_R + .02, 33.7)], 28, phi, Math.PI), band);
    put(pivot, new THREE.LatheGeometry([new THREE.Vector2(FAIRING_R + .02, 38.4), new THREE.Vector2(FAIRING_R + .02, 38.7)], 28, phi, Math.PI), accent);
    bakeColoured(pivot, shell);
    pivot.children[0].position.sub(hinge); pivot.position.copy(hinge);
    group.add(pivot);
    fairing.push({ pivot, axis: new THREE.Vector3(0, 1, 0).cross(out).normalize(), out });
  }
  paint.forEach(m => m.dispose());

  const setFairing = (open: number) => {
    for (const f of fairing) f.pivot.quaternion.setFromAxisAngle(f.axis, THREE.MathUtils.clamp(open, 0, 1) * FAIRING_OPEN);
  };
  // every part that can separate, with where it sits on the stack
  const homes = [core, ...boosters, ...fairing.map(f => f.pivot)].map(o => ({ o, p: o.position.clone(), q: o.quaternion.clone() }));
  const reset = () => {
    for (const h of homes) { group.add(h.o); h.o.position.copy(h.p); h.o.quaternion.copy(h.q); h.o.scale.setScalar(1); h.o.visible = true; }
    setFairing(0);
    for (const n of [coreNozzle, ...boosterNozzles]) n.flame.visible = false;
  };
  return { group, core, boosters, fairing, coreNozzle, boosterNozzles, setFairing, reset };
}

/** Concrete launch pad, its top at y = 0, with a service tower in the horizontal direction `towerAngle` (radians). */
export function buildLaunchPad(towerAngle: number) {
  const pad = new THREE.Group(), parts = new THREE.Group(), lattice = new THREE.Group();
  const tint = new Map<number, THREE.MeshStandardMaterial>();
  const m = (c: number) => { let x = tint.get(c); if (!x) { x = new THREE.MeshStandardMaterial({ color: c }); tint.set(c, x); } return x; };
  const box = (parent: THREE.Object3D, w: number, h: number, d: number, c: number, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(c)); b.position.set(x, y, z); parent.add(b); return b;
  };
  const concrete = 0x8a8680, steel = 0x9b3b2a, grey = 0x55595e;
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(15, 16, 2.6, 48), m(concrete)); slab.position.y = -1.3; parts.add(slab);
  box(parts, 7, .06, 30.5, 0x2a2826, 0, .02, 0);                                // scorched flame trench
  for (let i = 0; i < 4; i++) {                                                   // hold-down posts
    const a = i * Math.PI / 2 + Math.PI / 4; box(parts, .7, 1.4, .7, grey, Math.cos(a) * 3.3, .7, Math.sin(a) * 3.3);
  }
  // lattice tower: four legs, cross bracing every 4 m, crew arm reaching to the fairing
  const H = 48, W = 3.2, tx = 10.5;
  for (const x of [-1, 1]) for (const z of [-1, 1]) box(lattice, .35, H, .35, steel, tx + x * W / 2, H / 2, z * W / 2);
  for (let y = 2; y < H; y += 4) {
    box(lattice, W, .25, .25, steel, tx, y, W / 2); box(lattice, W, .25, .25, steel, tx, y, -W / 2);
    box(lattice, .25, .25, W, steel, tx + W / 2, y, 0); box(lattice, .25, .25, W, steel, tx - W / 2, y, 0);
    for (const z of [-1, 1]) { const d = box(lattice, .18, Math.hypot(4, W), .18, steel, tx, y + 2, z * W / 2); d.rotation.z = Math.atan2(W, 4) * (y % 8 ? 1 : -1); }
  }
  box(lattice, tx - W / 2 - 3.1, .6, 1.4, grey, (tx - W / 2 + 3.1) / 2 + .1, 36, 0);
  box(lattice, 4.4, 4.4, 4.4, grey, tx, H + 2.2, 0);
  parts.add(lattice);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .3, roughness: .8 });
  bakeColoured(parts, material);
  tint.forEach(x => x.dispose());
  parts.rotation.y = -towerAngle;              // local +X (the tower side) points along towerAngle
  pad.add(parts);
  return pad;
}
