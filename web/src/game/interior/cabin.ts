/**
 * The ship's bridge, generated in code in a low-poly style: a wide room with a panoramic window,
 * three wall monitors over control consoles, the pilot's seat and dashboard, and cargo at the
 * back. It is a stage for the mission setup, not a model of a real spacecraft.
 */
import * as THREE from 'three';
import { Kit } from './lowpoly';
import { ROOM, SCREEN, SEAT, STATIONS, type StationId } from './stations';

export interface ScreenMount { position: THREE.Vector3; rotationY: number }

const TEAL = 0x35d6ff, AMBER = 0xffb454, GREEN = 0x6dffb0, RED = 0xff5d5d;

/** A crew seat facing the window (negative z). */
function chair(kit: Kit, accent: number): THREE.Group {
  const g = new THREE.Group();
  const frame = kit.mat(0x3b4656, { metal: 0.5, rough: 0.5 }), pad = kit.mat(0x1d2430, { rough: 0.95 }), glow = kit.mat(accent, { emissive: accent, glow: 1.3 });
  g.add(kit.cyl(0.34, 0.42, 0.08, frame, 0, 0.04, 0, 10), kit.cyl(0.09, 0.11, 0.36, frame, 0, 0.24, 0, 8));
  g.add(kit.box(0.66, 0.12, 0.64, frame, 0, 0.44, 0), kit.box(0.56, 0.08, 0.54, pad, 0, 0.52, -0.01));
  const back = new THREE.Group(); back.position.set(0, 0.5, 0.3); back.rotation.x = 0.16; g.add(back);
  back.add(kit.box(0.64, 0.92, 0.12, frame, 0, 0.46, 0), kit.box(0.5, 0.74, 0.07, pad, 0, 0.44, -0.07));
  back.add(kit.box(0.36, 0.22, 0.14, frame, 0, 1.02, 0), kit.box(0.28, 0.14, 0.06, pad, 0, 1.02, -0.08));
  back.add(kit.box(0.66, 0.03, 0.13, glow, 0, 0.9, 0.005));
  for (const sx of [-1, 1]) {
    g.add(kit.box(0.08, 0.2, 0.08, frame, sx * 0.37, 0.58, 0.1), kit.box(0.1, 0.05, 0.5, frame, sx * 0.37, 0.7, -0.05));
    g.add(kit.box(0.1, 0.02, 0.12, glow, sx * 0.37, 0.735, -0.24));
  }
  return g;
}

/** A sloped control console with a keyboard slab and clusters of lit buttons. */
function consoleDesk(kit: Kit, width: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  const shell = kit.mat(0x2a3442, { metal: 0.35 }), top = kit.mat(0x161c26, { rough: 0.6 }), edge = kit.mat(accent, { emissive: accent, glow: 1.2 });
  g.add(kit.box(width, 0.82, 0.5, shell, 0, 0.41, 0.25), kit.box(width - 0.3, 0.1, 0.5, kit.mat(0x1b222d), 0, 0.05, 0.3));
  const deck = new THREE.Group(); deck.position.set(0, 0.86, 0.36); deck.rotation.x = 0.42; g.add(deck);
  deck.add(kit.box(width, 0.07, 0.62, top), kit.box(width, 0.02, 0.04, edge, 0, 0.04, 0.3));
  deck.add(kit.box(width * 0.36, 0.03, 0.26, kit.mat(0x0c1118), 0, 0.045, 0.06));                 // keyboard slab
  const colors = [accent, AMBER, RED, TEAL, GREEN];
  for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
    const c = colors[(i * 3 + (side > 0 ? 1 : 0)) % colors.length];
    deck.add(kit.box(0.07, 0.03, 0.07, kit.mat(c, { emissive: c, glow: 1.5 }), side * (width * 0.3 + (i % 4) * 0.11 - 0.16), 0.05, Math.floor(i / 4) * 0.13 - 0.02));
  }
  for (const side of [-1, 1]) {                                                                      // a lever at each end
    deck.add(kit.cyl(0.02, 0.02, 0.16, kit.mat(0x9aa7b8, { metal: 0.7 }), side * (width / 2 - 0.12), 0.11, 0.16, 5), kit.box(0.06, 0.06, 0.06, kit.mat(RED, { emissive: RED, glow: 0.8 }), side * (width / 2 - 0.12), 0.2, 0.16));
  }
  return g;
}

export function buildCabin(): { group: THREE.Group; mounts: Record<StationId, ScreenMount>; dispose(): void } {
  const kit = new Kit(), group = new THREE.Group();
  const W = ROOM.halfWidthM, D = ROOM.halfDepthM, H = ROOM.heightM;
  const hull = kit.mat(0x263242), panel = kit.mat(0x33435a), panelLight = kit.mat(0x44566f), trim = kit.mat(0x7f93ad, { metal: 0.5, rough: 0.45 });
  const floorMat = kit.mat(0x1b2330, { rough: 0.95 }), plate = kit.mat(0x232d3c, { rough: 0.9 }), dark = kit.mat(0x10151d);
  const glowWhite = kit.mat(0xeaf4ff, { emissive: 0xdcecff, glow: 1.5 }), glowTeal = kit.mat(TEAL, { emissive: TEAL, glow: 1.4 });

  // ---- shell
  group.add(kit.box(W * 2 + 0.4, 0.2, D * 2 + 0.4, floorMat, 0, -0.1, 0), kit.box(W * 2 + 0.4, 0.2, D * 2 + 0.4, hull, 0, H + 0.1, 0));
  group.add(kit.box(0.2, H, D * 2, hull, -W - 0.1, H / 2, 0), kit.box(0.2, H, D * 2, hull, W + 0.1, H / 2, 0), kit.box(W * 2, H, 0.2, hull, 0, H / 2, D + 0.1));
  // front wall: a sill, a brow and two pillars round the panoramic window
  const winHalf = 4.9, sill = 1.02, brow = 2.95;
  group.add(kit.box(W * 2, sill, 0.24, hull, 0, sill / 2, -D - 0.12), kit.box(W * 2, H - brow, 0.24, hull, 0, (H + brow) / 2, -D - 0.12));
  for (const sx of [-1, 1]) group.add(kit.box(W - winHalf, brow - sill, 0.24, hull, sx * (winHalf + (W - winHalf) / 2), (sill + brow) / 2, -D - 0.12));
  group.add(kit.box(winHalf * 2 + 0.2, 0.1, 0.34, trim, 0, sill, -D - 0.1), kit.box(winHalf * 2 + 0.2, 0.1, 0.34, trim, 0, brow, -D - 0.1));
  for (const x of [-winHalf, -2.45, 0, 2.45, winHalf]) {                                            // window struts, leaning in at the top
    const strut = kit.box(0.12, brow - sill + 0.1, 0.16, trim, x, (sill + brow) / 2, -D - 0.06); strut.rotation.x = -0.06; group.add(strut);
  }
  const glass = kit.mesh(new THREE.PlaneGeometry(winHalf * 2, brow - sill), kit.track(new THREE.MeshStandardMaterial({ color: 0x8fc7ff, transparent: true, opacity: 0.06, roughness: 0.05, depthWrite: false })), 0, (sill + brow) / 2, -D - 0.16);
  group.add(glass);

  // ---- floor: plates, a raised flight deck, glowing guide strips
  for (let ix = -4; ix <= 4; ix++) for (let iz = -3; iz <= 3; iz++) {
    if ((ix + iz) % 2 === 0) group.add(kit.box(1.22, 0.012, 1.18, plate, ix * 1.27, 0.006, iz * 1.22));
  }
  group.add(kit.cyl(2.5, 2.7, 0.07, plate, 0, 0.035, SEAT.z - 0.2, 12), kit.mesh(new THREE.TorusGeometry(2.55, 0.035, 4, 24), glowTeal, 0, 0.075, SEAT.z - 0.2));
  group.children[group.children.length - 1].rotation.x = Math.PI / 2;
  const strip = (x0: number, z0: number, x1: number, z1: number, mat: THREE.Material) => {
    const len = Math.hypot(x1 - x0, z1 - z0), s = kit.box(0.07, 0.014, len, mat, (x0 + x1) / 2, 0.012, (z0 + z1) / 2);
    s.rotation.y = Math.atan2(x1 - x0, z1 - z0); group.add(s);
  };
  for (const s of STATIONS) strip(0, 1.0, s.x + s.nx * 1.6, s.z + s.nz * 1.6, kit.mat(s.accent, { emissive: s.accent, glow: 1.1 }));
  strip(0, 1.0, 0, SEAT.z + 0.9, glowWhite);

  // ---- ceiling: beams, light panels, pipes
  for (const z of [-3, -1, 1, 3]) group.add(kit.box(W * 2, 0.22, 0.26, panel, 0, H - 0.11, z));
  for (const x of [-3.2, 0, 3.2]) for (const z of [-2, 2]) group.add(kit.box(1.5, 0.05, 0.5, glowWhite, x, H - 0.03, z));
  for (const sx of [-1, 1]) for (const [y, r] of [[H - 0.3, 0.09], [H - 0.52, 0.06]] as const) {
    const pipe = kit.cyl(r, r, D * 2, kit.mat(sx > 0 ? 0x8a6a3a : 0x52708f, { metal: 0.6, rough: 0.4 }), sx * (W - 0.28), y, 0, 7); pipe.rotation.x = Math.PI / 2; group.add(pipe);
  }

  // ---- wall panelling: ribs and inset panels on the side and back walls
  for (let z = -3.6; z <= 3.7; z += 1.2) for (const sx of [-1, 1]) group.add(kit.box(0.1, H, 0.12, panelLight, sx * (W - 0.05), H / 2, z));
  for (let x = -5.0; x <= 5.1; x += 1.25) group.add(kit.box(0.12, H, 0.1, panelLight, x, H / 2, D - 0.05));
  for (const sx of [-1, 1]) for (const z of [2.9, -3.1]) {
    group.add(kit.box(0.08, 1.5, 1.0, panel, sx * (W - 0.04), 1.6, z), kit.box(0.1, 0.06, 0.8, kit.mat(sx > 0 ? GREEN : TEAL, { emissive: sx > 0 ? GREEN : TEAL, glow: 1 }), sx * (W - 0.07), 2.42, z));
    for (let i = 0; i < 3; i++) group.add(kit.box(0.1, 0.22, 0.7, dark, sx * (W - 0.06), 1.1 + i * 0.36, z));    // vents
  }
  for (const sx of [-1, 1]) group.add(kit.box(1.5, 1.7, 0.08, panel, sx * 3.6, 1.7, D - 0.04), kit.box(1.2, 0.05, 0.1, kit.mat(AMBER, { emissive: AMBER, glow: 1 }), sx * 3.6, 2.62, D - 0.07));

  // ---- monitors: housing, glowing border and a console under each
  const mounts = {} as Record<StationId, ScreenMount>;
  for (const s of STATIONS) {
    const rotationY = Math.atan2(s.nx, s.nz);
    const unit = new THREE.Group(); unit.position.set(s.x, 0, s.z); unit.rotation.y = rotationY; group.add(unit);   // +z points into the room
    const glow = kit.mat(s.accent, { emissive: s.accent, glow: 1.6 }), w = SCREEN.widthM, h = SCREEN.heightM, cy = SCREEN.centreHeightM;
    unit.add(kit.box(w + 0.5, h + 0.5, 0.1, panelLight, 0, cy, 0.05));
    for (const [bw, bh, bx, by] of [[w + 0.26, 0.13, 0, h / 2 + 0.065], [w + 0.26, 0.13, 0, -h / 2 - 0.065], [0.13, h, -w / 2 - 0.065, 0], [0.13, h, w / 2 + 0.065, 0]] as const)
      unit.add(kit.box(bw, bh, 0.2, dark, bx, cy + by, 0.1));
    for (const [bw, bh, bx, by] of [[w + 0.3, 0.025, 0, h / 2 + 0.14], [w + 0.3, 0.025, 0, -h / 2 - 0.14], [0.025, h + 0.3, -w / 2 - 0.14, 0], [0.025, h + 0.3, w / 2 + 0.14, 0]] as const)
      unit.add(kit.box(bw, bh, 0.03, glow, bx, cy + by, 0.2));
    for (const sx of [-1, 1]) {                                                                      // small side readouts and speaker grilles
      unit.add(kit.box(0.34, 0.5, 0.06, dark, sx * (w / 2 + 0.48), cy + 0.25, 0.08), kit.box(0.26, 0.05, 0.02, glow, sx * (w / 2 + 0.48), cy + 0.38, 0.12), kit.box(0.26, 0.05, 0.02, kit.mat(AMBER, { emissive: AMBER, glow: 1.2 }), sx * (w / 2 + 0.48), cy + 0.26, 0.12));
      for (let i = 0; i < 4; i++) unit.add(kit.box(0.3, 0.035, 0.03, trim, sx * (w / 2 + 0.48), cy - 0.2 - i * 0.09, 0.09));
    }
    const desk = consoleDesk(kit, w + 0.6, s.accent); desk.position.z = 0.02; unit.add(desk);
    mounts[s.id] = { position: new THREE.Vector3(s.x + s.nx * 0.2, cy, s.z + s.nz * 0.2), rotationY };
  }

  // ---- flight deck: seats and the dashboard under the window
  const pilot = chair(kit, TEAL); pilot.position.set(SEAT.x, 0.07, SEAT.z); group.add(pilot);
  for (const sx of [-1, 1]) { const c = chair(kit, AMBER); c.position.set(sx * 2.0, 0.07, -1.98); c.rotation.y = -sx * 0.22; group.add(c); }
  const dash = new THREE.Group(); dash.position.set(0, 0, -D + 0.1); group.add(dash);
  dash.add(kit.box(8.0, 0.95, 0.7, kit.mat(0x2a3442, { metal: 0.35 }), 0, 0.475, 0.4));
  const deck = new THREE.Group(); deck.position.set(0, 1.0, 0.55); deck.rotation.x = 0.5; dash.add(deck);
  deck.add(kit.box(8.0, 0.08, 0.86, kit.mat(0x161c26)), kit.box(8.0, 0.02, 0.04, glowTeal, 0, 0.045, 0.42));
  const tiles = [TEAL, GREEN, AMBER, TEAL, 0x8e7dff, AMBER, GREEN, TEAL];
  tiles.forEach((c, i) => {                                                                          // lit instrument tiles with a brighter bar across each
    const x = -3.4 + i * 0.97;
    deck.add(kit.box(0.82, 0.02, 0.5, kit.mat(c, { emissive: c, glow: 0.35 }), x, 0.05, -0.08), kit.box(0.7, 0.025, 0.05, kit.mat(c, { emissive: c, glow: 1.7 }), x, 0.062, -0.2 + (i % 3) * 0.12));
  });
  const yoke = new THREE.Group(); yoke.position.set(0, 1.02, 1.12); dash.add(yoke);                   // control yoke in front of the pilot
  yoke.add(kit.cyl(0.035, 0.05, 0.42, trim, 0, -0.1, -0.12, 6)); yoke.children[0].rotation.x = 0.9;
  yoke.add(kit.box(0.5, 0.06, 0.06, dark, 0, 0.06, 0.04), kit.box(0.07, 0.2, 0.07, dark, -0.25, 0.13, 0.04), kit.box(0.07, 0.2, 0.07, dark, 0.25, 0.13, 0.04));

  // ---- cargo at the back
  for (const sx of [-1, 1]) {
    const crate = kit.mat(sx > 0 ? 0x566b52 : 0x6b5a44), strap = kit.mat(0x1b222d);
    group.add(kit.box(0.95, 0.7, 0.95, crate, sx * 4.75, 0.35, 3.55), kit.box(0.97, 0.08, 0.97, strap, sx * 4.75, 0.5, 3.55));
    const upper = kit.box(0.7, 0.55, 0.7, kit.mat(sx > 0 ? 0x6b5a44 : 0x566b52), sx * 4.8, 0.975, 3.6); upper.rotation.y = 0.3 * sx; group.add(upper);
    group.add(kit.cyl(0.2, 0.2, 0.9, kit.mat(0x8c98aa, { metal: 0.6, rough: 0.35 }), sx * 3.95, 0.45, 3.9, 8), kit.cyl(0.21, 0.21, 0.06, kit.mat(RED, { emissive: RED, glow: 0.5 }), sx * 3.95, 0.72, 3.9, 8));
  }

  return { group, mounts, dispose: () => kit.dispose() };
}
