/**
 * The ship's bridge, generated in code: a wide room with a panoramic window, three wall
 * monitors over control consoles, the pilot's seat and dashboard, a hatch and stowage at the
 * back. The look follows real crew cabins (off-white panels with seams, grey structure, dark
 * floor, handrails, placards) and keeps colour for things that mean something. It is a stage
 * for the mission setup, not a model of a real spacecraft.
 */
import * as THREE from 'three';
import { Kit, mergeStatic, seeded } from './lowpoly';
import { ROOM, SCREEN, SEAT, STATIONS, type StationId } from './stations';

export interface ScreenMount { position: THREE.Vector3; rotationY: number }

const PLACARDS = ['CABIN PRESS', 'O2 / N2 SUPPLY', 'AUX PWR BUS B', 'COMM 1 / COMM 2', 'ECLSS FAN 2', 'PANEL A3', 'STOWAGE 14', 'FIRE PORT'];
const INK = '#c9d2d8';

/** Everything the builders share: materials and the few drawn textures. */
function palette(kit: Kit) {
  // faint dirt, streaks and darker edges, multiplied over the wall panels so each one reads as a separate part
  const wear = kit.texture(256, 256, (g, w, h) => {
    const rnd = seeded(5);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(60,58,54,${0.015 + rnd() * 0.03})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2); }
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(70,66,60,${0.012 + rnd() * 0.015})`; g.fillRect(rnd() * w, 0, 6 + rnd() * 14, h * (0.3 + rnd() * 0.7)); }
    const edge = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
    edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(40,40,40,0.2)');
    g.fillStyle = edge; g.fillRect(0, 0, w, h);
  });
  const placards = kit.texture(512, 512, (g, w) => {
    g.fillStyle = '#d9d6cc'; g.fillRect(0, 0, w, 512);
    g.font = '600 34px Helvetica, Arial, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
    PLACARDS.forEach((t, i) => { g.strokeStyle = '#2a2b2d'; g.lineWidth = 3; g.strokeRect(5, i * 64 + 5, w - 10, 54); g.fillStyle = '#1d1e20'; g.fillText(t, w / 2, i * 64 + 33); });
  });
  const caution = kit.texture(256, 32, (g, w, h) => {
    g.fillStyle = '#c9a019'; g.fillRect(0, 0, w, h); g.fillStyle = '#17181a';
    for (let x = -h; x < w; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.lineTo(x + h + 16, 0); g.lineTo(x + 16, h); g.fill(); }
  });
  // dim monochrome instrument pages for the dashboard and console side displays
  const attitude = kit.texture(512, 256, (g, w, h) => {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
    g.save(); g.beginPath(); g.arc(150, 128, 96, 0, Math.PI * 2); g.clip(); g.translate(150, 128); g.rotate(-0.14);
    g.fillStyle = '#1b2a3a'; g.fillRect(-140, -140, 280, 152); g.fillStyle = '#2b241b'; g.fillRect(-140, 12, 280, 140);
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(-140, 12); g.lineTo(140, 12); g.stroke();
    g.lineWidth = 1; for (const d of [-60, -30, 30, 60]) { g.beginPath(); g.moveTo(-22, 12 + d); g.lineTo(22, 12 + d); g.stroke(); }
    g.restore();
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(150, 128, 96, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(110, 128); g.lineTo(138, 128); g.lineTo(150, 138); g.lineTo(162, 128); g.lineTo(190, 128); g.stroke();
    g.font = '15px Menlo, monospace'; g.fillStyle = INK;
    [['ATT', 'INRTL'], ['ROLL', '-008.1'], ['PITCH', '+002.4'], ['YAW', '+000.3'], ['RATE', '0.02 d/s'], ['RNG', '384 Mm']].forEach(([k, v], i) => { g.fillStyle = '#8b959d'; g.fillText(k, 290, 44 + i * 34); g.fillStyle = INK; g.fillText(v, 370, 44 + i * 34); });
  });
  const gauges = kit.texture(512, 256, (g, w, h) => {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h); g.font = '14px Menlo, monospace';
    [['O2', 0.82], ['N2', 0.77], ['H2O', 0.61], ['BUS A', 0.9], ['BUS B', 0.88], ['PROP', 0.69], ['RCS', 0.74], ['TEMP', 0.46]].forEach(([name, v], i) => {
      const x = 30 + i * 58;
      g.strokeStyle = '#59636c'; g.lineWidth = 1; g.strokeRect(x, 28, 26, 170);
      g.fillStyle = name === 'H2O' ? '#b08a3a' : '#8fa2ad'; g.fillRect(x + 3, 28 + 170 * (1 - (v as number)), 20, 170 * (v as number) - 2);
      for (let t = 0; t <= 4; t++) { g.fillStyle = '#59636c'; g.fillRect(x + 28, 28 + t * 42, 6, 1); }
      g.fillStyle = '#8b959d'; g.fillText(name as string, x - 4, 222); g.fillStyle = INK; g.fillText(String(Math.round((v as number) * 100)), x + 2, 242);
    });
  });
  const readout = kit.texture(512, 256, (g, w, h) => {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h); g.font = '15px Menlo, monospace';
    g.fillStyle = INK; g.fillText('SYS SUMMARY 1', 20, 30); g.fillStyle = '#59636c'; g.fillRect(20, 40, w - 40, 1);
    [['CABIN PRESS', '101.2 kPa', 0], ['PPO2', '21.3 kPa', 0], ['CO2', '0.41 kPa', 0], ['CABIN TEMP', '22.4 C', 0], ['FC 1 / 2', 'ON / ON', 0], ['HI GAIN', 'LOCK', 1], ['GUID', 'STBY', 2], ['EVENT TMR', '00:14:52', 0]].forEach(([k, v, s], i) => {
      g.fillStyle = '#8b959d'; g.fillText(k as string, 20, 68 + i * 23); g.fillStyle = s === 1 ? '#6fbf8f' : s === 2 ? '#c79a45' : INK; g.fillText(v as string, 300, 68 + i * 23);
    });
  });
  const panelA = kit.mat(0xd9d9d5, { rough: 0.9 }), panelB = kit.mat(0xcacbc8, { rough: 0.9 }), floor = kit.mat(0x44474b, { rough: 0.95 });
  panelA.map = wear; panelB.map = wear; floor.map = wear;
  const display = (map: THREE.Texture, gain = 0.85) => kit.track(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: gain, roughness: 0.25, metalness: 0 }));
  return {
    panelA, panelB,
    hull: kit.mat(0x2c2e30, { rough: 0.9 }), structure: kit.mat(0x7a7e82, { metal: 0.35, rough: 0.6 }), housing: kit.mat(0x9fa1a2, { rough: 0.75 }),
    black: kit.mat(0x141517, { rough: 0.6 }), top: kit.mat(0x222426, { rough: 0.7 }), floor, mat: kit.mat(0x54585c, { rough: 1 }),
    metal: kit.mat(0xb6babd, { metal: 0.8, rough: 0.35, smooth: true }), fabric: kit.mat(0x2a2d33, { rough: 1 }), strap: kit.mat(0x8f8a7c, { rough: 1 }),
    railBlue: kit.mat(0x2d5c9e, { metal: 0.6, rough: 0.4, smooth: true }), railYellow: kit.mat(0xc79f1c, { metal: 0.5, rough: 0.45, smooth: true }),
    guard: kit.mat(0xa5382e, { rough: 0.6 }), key: kit.mat(0x5a5e63, { rough: 0.8 }), bag: kit.mat(0xe2dfd6, { rough: 1 }), paint: kit.mat(0xd8d8d4, { rough: 0.95 }),
    lamp: kit.mat(0xfff6ea, { emissive: 0xfff1de, glow: 2.2 }), led: kit.mat(0x7fd6a0, { emissive: 0x6fcf95, glow: 1.4 }), cable: [kit.mat(0x1b1c1e, { smooth: true }), kit.mat(0x8d9093, { smooth: true }), kit.mat(0xd5d2c9, { smooth: true })],
    placardMat: kit.track(new THREE.MeshStandardMaterial({ map: placards, roughness: 0.9 })), cautionMat: kit.track(new THREE.MeshStandardMaterial({ map: caution, roughness: 0.9 })),
    displays: [display(attitude), display(gauges), display(readout)], sideDisplay: display(readout, 0.6),
  };
}
type Palette = ReturnType<typeof palette>;

/** A printed placard, lying flat on a surface that faces +z. */
function placard(kit: Kit, p: Palette, index: number, width: number, x: number, y: number, z: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, width / 8), n = PLACARDS.length, i = index % n;
  const v0 = 1 - (i + 1) / n, v1 = 1 - i / n;
  (geo.attributes.uv as THREE.BufferAttribute).set([0, v1, 1, v1, 0, v0, 1, v0]);
  const m = kit.mesh(geo, p.placardMat, x, y, z); m.castShadow = false; return m;
}

/** A handrail on standoffs, along x (or upright), 9 cm proud of the surface at z. */
function handrail(kit: Kit, p: Palette, length: number, x: number, y: number, z: number, mat: THREE.Material, upright = false): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const bar = kit.cyl(0.022, 0.022, length, mat, 0, 0, 0.09, 10); if (!upright) bar.rotation.z = Math.PI / 2; g.add(bar);
  for (const s of [-1, 1]) g.add(upright ? kit.box(0.04, 0.05, 0.09, p.structure, 0, s * (length / 2 - 0.06), 0.045) : kit.box(0.05, 0.04, 0.09, p.structure, s * (length / 2 - 0.06), 0, 0.045));
  return g;
}

/** A row of small toggle switches on a label strip, lying on a surface that faces +y. */
function switchRow(kit: Kit, p: Palette, count: number, x: number, y: number, z: number, guarded = 0): THREE.Group {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(kit.box(count * 0.07 + 0.04, 0.004, 0.026, p.paint, 0, 0.002, 0.055));
  for (let i = 0; i < count; i++) {
    const sx = (i - (count - 1) / 2) * 0.07;
    g.add(kit.cyl(0.014, 0.014, 0.008, p.metal, sx, 0.004, 0, 8));
    const lever = kit.cyl(0.006, 0.008, 0.04, p.metal, sx, 0.022, (i * 7) % 3 === 0 ? 0.008 : -0.008, 6); lever.rotation.x = (i * 7) % 3 === 0 ? 0.4 : -0.4; g.add(lever);
    if (i < guarded) g.add(kit.box(0.04, 0.035, 0.012, p.guard, sx, 0.02, -0.035), kit.box(0.04, 0.012, 0.07, p.guard, sx, 0.043, 0));
  }
  return g;
}

/** A crew seat facing the window (negative z): grey frame, dark fabric cushions and a harness. */
function chair(kit: Kit, p: Palette): THREE.Group {
  const g = new THREE.Group();
  g.add(kit.cyl(0.34, 0.4, 0.05, p.structure, 0, 0.025, 0, 16), kit.cyl(0.07, 0.09, 0.38, p.structure, 0, 0.24, 0, 10));
  g.add(kit.box(0.64, 0.1, 0.62, p.structure, 0, 0.45, 0), kit.box(0.56, 0.09, 0.54, p.fabric, 0, 0.525, -0.01));
  const back = new THREE.Group(); back.position.set(0, 0.5, 0.3); back.rotation.x = 0.16; g.add(back);
  back.add(kit.box(0.62, 0.92, 0.1, p.structure, 0, 0.46, 0), kit.box(0.52, 0.76, 0.08, p.fabric, 0, 0.45, -0.07));
  back.add(kit.box(0.34, 0.22, 0.12, p.structure, 0, 1.02, 0), kit.box(0.28, 0.16, 0.07, p.fabric, 0, 1.02, -0.075));
  for (const sx of [-1, 1]) {
    back.add(kit.box(0.05, 0.7, 0.012, p.strap, sx * 0.13, 0.5, -0.115), kit.box(0.07, 0.05, 0.02, p.metal, sx * 0.13, 0.2, -0.12));     // harness
    g.add(kit.box(0.07, 0.2, 0.07, p.structure, sx * 0.36, 0.58, 0.1), kit.box(0.09, 0.045, 0.48, p.fabric, sx * 0.36, 0.7, -0.05));
  }
  return g;
}

/** A sloped control console: grey housing, black top, keyboard, switch rows and a small side display. */
function consoleDesk(kit: Kit, p: Palette, width: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(kit.box(width, 0.78, 0.46, p.housing, 0, 0.45, 0.25), kit.box(width - 0.2, 0.08, 0.4, p.black, 0, 0.04, 0.25));
  g.add(kit.box(0.5, 0.012, 0.012, p.black, -width / 4, 0.5, 0.482), kit.box(0.5, 0.012, 0.012, p.black, width / 4, 0.5, 0.482));     // access-panel seams
  g.add(placard(kit, p, seed + 5, 0.3, 0, 0.66, 0.482));
  const deck = new THREE.Group(); deck.position.set(0, 0.86, 0.36); deck.rotation.x = 0.42; g.add(deck);
  deck.add(kit.box(width, 0.06, 0.62, p.top), kit.box(width, 0.03, 0.05, p.housing, 0, 0.02, 0.31));
  const rest = kit.cyl(0.022, 0.022, width - 0.1, p.metal, 0, 0.05, 0.335, 10); rest.rotation.z = Math.PI / 2; deck.add(rest);
  deck.add(kit.box(0.86, 0.016, 0.3, p.black, 0, 0.036, 0.08));                                        // keyboard
  for (let r = 0; r < 4; r++) deck.add(kit.box(0.8, 0.012, 0.05, p.key, 0, 0.047, -0.025 + r * 0.068));
  const screen = kit.mesh(new THREE.PlaneGeometry(0.5, 0.25), p.sideDisplay, width / 2 - 0.5, 0.034, -0.08); screen.rotation.x = -Math.PI / 2; screen.castShadow = false;
  deck.add(kit.box(0.56, 0.02, 0.31, p.black, width / 2 - 0.5, 0.022, -0.08), screen);
  deck.add(switchRow(kit, p, 6, width / 2 - 0.5, 0.03, 0.15, 2), switchRow(kit, p, 7, -width / 2 + 0.5, 0.03, -0.14), switchRow(kit, p, 7, -width / 2 + 0.5, 0.03, 0.02));
  for (let i = 0; i < 3; i++) deck.add(kit.cyl(0.028, 0.032, 0.03, p.black, -width / 2 + 0.3 + i * 0.16, 0.045, 0.19, 12));     // rotary knobs
  return g;
}

/** One wall, built in its own frame: x along the wall, y up, z out into the room. */
function wall(kit: Kit, p: Palette, halfLen: number, monitorX: number, seed: number, keepClear = Infinity): THREE.Group {
  const g = new THREE.Group(), rnd = seeded(seed);
  g.add(kit.box(halfLen * 2, 0.12, 0.04, p.black, 0, 0.06, 0.02));                                    // skirting
  g.add(kit.box(halfLen * 2, 0.56, 0.1, p.structure, 0, 3.2, 0.05));                                  // structure band under the ceiling
  g.add(kit.box(halfLen * 2 - 0.3, 0.03, 0.32, p.hull, 0, 2.99, 0.2));                                // cable tray and its cables
  [0.09, 0.17, 0.27].forEach((z, i) => { const c = kit.cyl(0.022 + i * 0.006, 0.022 + i * 0.006, halfLen * 2 - 0.5, p.cable[i], 0, 3.03, z, 8); c.rotation.z = Math.PI / 2; g.add(c); });
  for (let x = -halfLen + 0.7; x < halfLen; x += 1.45) g.add(kit.box(0.04, 0.12, 0.34, p.structure, x, 3.03, 0.2));
  g.add(kit.box(3.86, 2.74, 0.04, p.structure, monitorX, 1.49, 0.02));                                // plate behind the monitor
  const widths = [0.95, 1.3, 0.72, 1.12];
  let k = Math.floor(rnd() * 4);
  for (const [from, to] of [[-halfLen + 0.04, monitorX - 1.95], [monitorX + 1.95, halfLen - 0.04]]) {
    let x = from;
    while (x < to - 0.2) {
      let w = widths[k % 4]; if (to - (x + w) < 0.5) w = to - x;
      const cx = x + w / 2, a = k % 2 ? p.panelA : p.panelB, b = k % 2 ? p.panelB : p.panelA;
      g.add(kit.box(w - 0.03, 1.04, 0.05, a, cx, 0.66, 0.025), kit.box(w - 0.03, 1.66, 0.05, b, cx, 2.05, 0.025));
      if (k % 3 === 0) {                                                                              // stowage locker: split doors and a latch
        g.add(kit.box(0.012, 0.98, 0.052, p.hull, cx, 0.66, 0.026), kit.box(0.2, 0.035, 0.03, p.metal, cx, 1.02, 0.065));
        g.add(placard(kit, p, 6, Math.min(0.3, w * 0.4), cx - w / 4, 0.98, 0.052));
      }
      if (k % 3 === 1 && w > 0.8) {                                                                   // air vent
        g.add(kit.box(w * 0.6, 0.3, 0.02, p.black, cx, 2.55, 0.045));
        for (let i = 0; i < 5; i++) { const slat = kit.box(w * 0.6, 0.012, 0.04, p.structure, cx, 2.44 + i * 0.055, 0.06); slat.rotation.x = 0.5; g.add(slat); }
      }
      if (k % 3 === 2) g.add(placard(kit, p, k, Math.min(0.34, w * 0.5), cx, 1.62, 0.052));
      if (k % 2 === 0 && w > 0.8 && Math.abs(cx - keepClear) > 1.5) g.add(handrail(kit, p, w * 0.7, cx, 1.24, 0.05, p.railBlue));
      x += w; k++;
    }
  }
  return g;
}

export function buildCabin(): { group: THREE.Group; mounts: Record<StationId, ScreenMount>; dispose(): void } {
  const kit = new Kit(), group = new THREE.Group(), p = palette(kit);
  const W = ROOM.halfWidthM, D = ROOM.halfDepthM, H = ROOM.heightM;

  // ---- shell: dark hull behind everything, so the gaps between panels read as seams
  for (let ix = -5; ix < 5; ix++) for (let iz = -4; iz < 4; iz++) group.add(kit.box(1.2, 0.2, 1.2, p.floor, ix * 1.2 + 0.6, -0.1, iz * 1.2 + 0.2));   // floor plates
  group.add(kit.box(W * 2 + 0.4, 0.2, D * 2 + 0.4, p.panelB, 0, H + 0.1, 0));
  group.add(kit.box(0.2, H, D * 2, p.hull, -W - 0.1, H / 2, 0), kit.box(0.2, H, D * 2, p.hull, W + 0.1, H / 2, 0), kit.box(W * 2, H, 0.2, p.hull, 0, H / 2, D + 0.1));
  // front wall: a sill, a brow and two pillars round the panoramic window
  const winHalf = 4.9, sill = 1.02, brow = 2.95;
  group.add(kit.box(W * 2, sill, 0.24, p.panelB, 0, sill / 2, -D - 0.12), kit.box(W * 2, H - brow, 0.24, p.panelA, 0, (H + brow) / 2, -D - 0.12));
  for (const sx of [-1, 1]) group.add(kit.box(W - winHalf, brow - sill, 0.24, p.panelA, sx * (winHalf + (W - winHalf) / 2), (sill + brow) / 2, -D - 0.12));
  group.add(kit.box(winHalf * 2 + 0.2, 0.1, 0.34, p.structure, 0, sill, -D - 0.1), kit.box(winHalf * 2 + 0.2, 0.1, 0.34, p.structure, 0, brow, -D - 0.1));
  for (const x of [-winHalf, -2.45, 0, 2.45, winHalf]) {                                            // window frames, leaning in at the top
    const strut = kit.box(0.12, brow - sill + 0.1, 0.16, p.structure, x, (sill + brow) / 2, -D - 0.06); strut.rotation.x = -0.06; group.add(strut);
  }
  const glass = kit.mesh(new THREE.PlaneGeometry(winHalf * 2, brow - sill), kit.track(new THREE.MeshStandardMaterial({ color: 0xdfe8f0, transparent: true, opacity: 0.05, roughness: 0.05, depthWrite: false })), 0, (sill + brow) / 2, -D - 0.16);
  glass.castShadow = glass.receiveShadow = false; group.add(glass);
  group.add(handrail(kit, p, 1.6, -2.6, brow + 0.22, -D, p.railBlue), handrail(kit, p, 1.6, 2.6, brow + 0.22, -D, p.railBlue));

  // ---- floor: dark plates with seams, a lighter non-slip mat on the flight deck, one painted line
  for (let x = -W + 0.6; x < W; x += 1.2) group.add(kit.box(0.014, 0.004, D * 2, p.black, x, 0.002, 0));
  for (let z = -D + 0.8; z < D; z += 1.2) group.add(kit.box(W * 2, 0.004, 0.014, p.black, 0, 0.002, z));
  group.add(kit.box(6.6, 0.012, 2.5, p.mat, 0, 0.006, -2.2), kit.box(6.6, 0.014, 0.04, p.paint, 0, 0.007, -0.93));

  // ---- ceiling: ribs, light panels in frames, air diffusers
  for (const z of [-3, -1, 1, 3]) group.add(kit.box(W * 2, 0.18, 0.22, p.structure, 0, H - 0.09, z));
  for (const x of [-3.2, 0, 3.2]) for (const z of [-2, 2]) {
    const light = kit.box(1.5, 0.03, 0.5, p.lamp, x, H - 0.025, z); light.castShadow = false;
    group.add(kit.box(1.62, 0.05, 0.62, p.structure, x, H - 0.02, z), light);
  }
  for (const x of [-1.6, 1.6]) { group.add(kit.box(0.7, 0.03, 0.7, p.black, x, H - 0.015, 0)); for (let i = 0; i < 5; i++) group.add(kit.box(0.66, 0.02, 0.03, p.structure, x, H - 0.03, -0.26 + i * 0.13)); }

  // ---- walls: panel modules, lockers, vents, handrails, cable trays
  const left = wall(kit, p, D, 0.4, 3); left.position.set(-W, 0, 0); left.rotation.y = Math.PI / 2;
  const right = wall(kit, p, D, -0.4, 8); right.position.set(W, 0, 0); right.rotation.y = -Math.PI / 2;
  const hx = 3.0, back = wall(kit, p, W, 0, 21, hx); back.position.set(0, 0, D); back.rotation.y = Math.PI;
  group.add(left, right, back);
  // a few one-off fittings so the walls are not the same three modules repeated
  const extinguisher = (w: THREE.Group, x: number) => {
    w.add(kit.box(0.22, 0.5, 0.03, p.structure, x, 1.05, 0.065), kit.cyl(0.075, 0.075, 0.38, kit.mat(0xa5382e, { rough: 0.5, smooth: true }), x, 1.02, 0.15, 12),
      kit.cyl(0.03, 0.045, 0.07, p.black, x, 1.245, 0.15, 8), kit.box(0.2, 0.03, 0.02, p.metal, x, 1.08, 0.23), placard(kit, p, 7, 0.22, x, 1.36, 0.052));
  };
  const drawers = (w: THREE.Group, x: number) => {
    w.add(kit.box(0.74, 0.92, 0.12, p.housing, x, 1.72, 0.11));
    for (let i = 0; i < 4; i++) w.add(kit.box(0.68, 0.19, 0.02, p.panelA, x, 1.39 + i * 0.22, 0.18), kit.box(0.2, 0.025, 0.03, p.metal, x, 1.39 + i * 0.22, 0.2));
    w.add(placard(kit, p, 5, 0.3, x, 2.24, 0.052));
  };
  extinguisher(right, 3.6); extinguisher(back, -4.2); drawers(left, 3.1); drawers(back, -2.75);
  // hatch in the back wall, with the one caution stripe on the bridge at its sill
  back.add(kit.box(1.2, 2.1, 0.09, p.structure, hx, 1.12, 0.045), kit.box(1.0, 1.9, 0.05, p.panelA, hx, 1.12, 0.1));
  const port = kit.cyl(0.17, 0.17, 0.03, p.black, hx, 1.7, 0.13, 20); port.rotation.x = Math.PI / 2;
  const ring = kit.mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 24), p.metal, hx, 1.7, 0.135);
  const lever = kit.box(0.32, 0.05, 0.04, p.metal, hx + 0.1, 1.1, 0.15); lever.rotation.z = 0.5;
  const stripe = kit.box(1.2, 0.05, 0.16, p.cautionMat, hx, 0.025, 0.14);
  back.add(port, ring, lever, kit.cyl(0.05, 0.05, 0.05, p.metal, hx - 0.03, 1.03, 0.14, 12), stripe, placard(kit, p, 7, 0.34, hx, 2.0, 0.127));
  (back.children[back.children.length - 3] as THREE.Mesh).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) back.add(handrail(kit, p, 0.9, hx + s * 0.72, 1.25, 0.05, p.railYellow, true));

  // ---- monitors: grey housing, black bezel, and a console under each
  const mounts = {} as Record<StationId, ScreenMount>;
  STATIONS.forEach((s, index) => {
    const rotationY = Math.atan2(s.nx, s.nz);
    const unit = new THREE.Group(); unit.position.set(s.x, 0, s.z); unit.rotation.y = rotationY; group.add(unit);   // +z points into the room
    const w = SCREEN.widthM, h = SCREEN.heightM, cy = SCREEN.centreHeightM;
    unit.add(kit.box(w + 0.5, h + 0.5, 0.1, p.housing, 0, cy, 0.05), kit.box(w + 0.56, 0.05, 0.16, p.structure, 0, cy + h / 2 + 0.275, 0.08));
    for (const [bw, bh, bx, by] of [[w + 0.26, 0.13, 0, h / 2 + 0.065], [w + 0.26, 0.13, 0, -h / 2 - 0.065], [0.13, h, -w / 2 - 0.065, 0], [0.13, h, w / 2 + 0.065, 0]] as const)
      unit.add(kit.box(bw, bh, 0.2, p.black, bx, cy + by, 0.1));
    unit.add(kit.box(0.018, 0.018, 0.01, p.led, w / 2 + 0.02, cy - h / 2 - 0.065, 0.202));                // power light on the bezel
    for (const sx of [-1, 1]) {                                                                      // side panels: a placard and a speaker grille
      unit.add(kit.box(0.36, 1.0, 0.05, p.panelA, sx * (w / 2 + 0.5), cy, 0.075), placard(kit, p, index * 2 + (sx > 0 ? 1 : 0), 0.3, sx * (w / 2 + 0.5), cy + 0.36, 0.101));
      unit.add(kit.box(0.28, 0.3, 0.01, p.black, sx * (w / 2 + 0.5), cy - 0.2, 0.101));
      for (let i = 0; i < 5; i++) unit.add(kit.box(0.26, 0.014, 0.012, p.structure, sx * (w / 2 + 0.5), cy - 0.31 + i * 0.055, 0.108));
    }
    const desk = consoleDesk(kit, p, w + 0.6, index); desk.position.z = 0.02; unit.add(desk);
    mounts[s.id] = { position: new THREE.Vector3(s.x + s.nx * 0.2, cy, s.z + s.nz * 0.2), rotationY };
  });

  // ---- flight deck: seats and the dashboard under the window
  const pilot = chair(kit, p); pilot.position.set(SEAT.x, 0.012, SEAT.z); group.add(pilot);
  for (const sx of [-1, 1]) { const c = chair(kit, p); c.position.set(sx * 2.0, 0.012, -1.98); c.rotation.y = -sx * 0.22; group.add(c); }
  const dash = new THREE.Group(); dash.position.set(0, 0, -D + 0.1); group.add(dash);
  dash.add(kit.box(8.0, 0.95, 0.7, p.housing, 0, 0.475, 0.4), kit.box(7.8, 0.08, 0.6, p.black, 0, 0.04, 0.42));
  for (const x of [-2.67, 0, 2.67]) dash.add(kit.box(0.012, 0.8, 0.012, p.black, x, 0.52, 0.752));
  dash.add(placard(kit, p, 2, 0.34, -1.3, 0.8, 0.752), placard(kit, p, 3, 0.34, 1.3, 0.8, 0.752));
  const deck = new THREE.Group(); deck.position.set(0, 1.0, 0.55); deck.rotation.x = 0.5; dash.add(deck);
  deck.add(kit.box(8.0, 0.07, 0.86, p.top), kit.box(8.0, 0.03, 0.05, p.housing, 0, 0.02, 0.43));
  p.displays.forEach((material, i) => {                                                              // three glass displays
    const x = (i - 1) * 2.5, screen = kit.mesh(new THREE.PlaneGeometry(1.24, 0.62), material, x, 0.047, -0.07);
    screen.rotation.x = -Math.PI / 2; screen.castShadow = false;
    deck.add(kit.box(1.34, 0.02, 0.72, p.black, x, 0.036, -0.07), screen);
  });
  for (const x of [-3.55, -1.25, 1.25, 3.55]) deck.add(switchRow(kit, p, 6, x, 0.036, -0.2, Math.abs(x) > 3 ? 2 : 0), switchRow(kit, p, 6, x, 0.036, -0.02), switchRow(kit, p, 5, x, 0.036, 0.16));
  const yoke = new THREE.Group(); yoke.position.set(0, 1.02, 1.12); dash.add(yoke);                   // control yoke in front of the pilot
  const column = kit.cyl(0.035, 0.05, 0.42, p.structure, 0, -0.1, -0.12, 8); column.rotation.x = 0.9;
  yoke.add(column, kit.box(0.5, 0.06, 0.06, p.black, 0, 0.06, 0.04), kit.box(0.07, 0.2, 0.07, p.black, -0.25, 0.13, 0.04), kit.box(0.07, 0.2, 0.07, p.black, 0.25, 0.13, 0.04));

  // ---- stowage at the back: soft cargo bags strapped down
  for (const sx of [-1, 1]) {
    const bag = (w: number, h: number, d: number, x: number, y: number, z: number, turn: number, label: number) => {
      const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = turn; group.add(b);
      b.add(kit.box(w, h, d, p.bag), kit.box(w + 0.01, 0.05, d + 0.01, p.strap, 0, h * 0.18, 0), kit.box(0.05, h + 0.01, d + 0.01, p.strap, w * 0.28, 0, 0));
      const tag = placard(kit, p, label, 0.26, -w * 0.12, -h * 0.12, -d / 2 - 0.002); tag.rotation.y = Math.PI; b.add(tag);
    };
    bag(0.95, 0.52, 0.66, sx * 4.74, 0.26, 3.72, 0, 6); bag(0.8, 0.44, 0.56, sx * 4.76, 0.74, 3.76, 0.12 * sx, 5); bag(0.52, 0.4, 0.46, sx * 4.58, 0.2, 3.24, -0.2 * sx, 4);
  }

  return { group: mergeStatic(group, kit), mounts, dispose: () => kit.dispose() };
}
