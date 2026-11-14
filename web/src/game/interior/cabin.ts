/**
 * The lander cabin, generated in code: an eight-sided room with four monitor frames, a porthole
 * and a few fittings. It is a stage for the mission setup, not a model of a real spacecraft.
 */
import * as THREE from 'three';
import { CABIN, STATIONS, WINDOW_ANGLE_DEG } from './stations';

const RAD = Math.PI / 180;
/** Size of a monitor's screen in the scene, m. The DOM screens are scaled to match. */
export const SCREEN = { widthM: 1.5, heightM: 1.02 };

/** Position and facing for something mounted on the wall at an angle. */
export function wallMount(angleDeg: number, inset = 0, height: number = CABIN.monitorHeightM): { position: THREE.Vector3; rotationY: number } {
  const a = angleDeg * RAD, r = CABIN.wallM - inset;
  // rotation that turns an object's +Z face toward the cabin centre
  return { position: new THREE.Vector3(Math.sin(a) * r, height, -Math.cos(a) * r), rotationY: -a };
}

export function buildCabin(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const made: Array<{ dispose(): void }> = [];
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.15, ...extra }); made.push(m); return m; };
  const box = (w: number, h: number, d: number, material: THREE.Material) => { const g = new THREE.BoxGeometry(w, h, d); made.push(g); return new THREE.Mesh(g, material); };

  const wall = mat(0x4a4f57), trim = mat(0x6b717b, { metalness: 0.35, roughness: 0.6 }), dark = mat(0x0b0c0e), accent = mat(0xd9b872, { emissive: 0x4a3a16, roughness: 0.5 });
  const glow = mat(0xfff2d6, { emissive: 0xfff2d6, emissiveIntensity: 1.1 });
  const H = CABIN.heightM, R = CABIN.wallM, side = 2 * R * Math.tan(22.5 * RAD) + 0.04;

  // floor and ceiling: eight-sided plates
  const plate = new THREE.CylinderGeometry(R / Math.cos(22.5 * RAD), R / Math.cos(22.5 * RAD), 0.08, 8); plate.rotateY(22.5 * RAD); made.push(plate);
  const floor = new THREE.Mesh(plate, mat(0x30343a, { roughness: 0.95 })); floor.position.y = -0.04; group.add(floor);
  const ceiling = new THREE.Mesh(plate, mat(0x565b63)); ceiling.position.y = H + 0.04; group.add(ceiling);
  // floor grating lines and a centre ring, so walking reads as movement
  for (let i = -3; i <= 3; i++) {
    const line = box(R * 1.9, 0.005, 0.03, trim); line.position.set(0, 0.004, i * 0.7); group.add(line);
    const cross = box(0.03, 0.005, R * 1.9, trim); cross.position.set(i * 0.7, 0.004, 0); group.add(cross);
  }
  const ringGeo = new THREE.RingGeometry(0.55, 0.6, 48); ringGeo.rotateX(-Math.PI / 2); made.push(ringGeo);
  const ring = new THREE.Mesh(ringGeo, accent); ring.position.y = 0.008; group.add(ring);

  const stationAngles = new Set(STATIONS.map(s => s.angleDeg));
  for (let k = 0; k < 8; k++) {
    const angle = k * 45 - 180 + 45;                     // -135 … 180 in steps of 45
    const { position, rotationY } = wallMount(angle, 0, H / 2);
    const face = new THREE.Group(); face.position.copy(position); face.rotation.y = rotationY; group.add(face);

    if (angle === WINDOW_ANGLE_DEG) {
      // a wall with a porthole: four panels round an opening, a frame, and tinted glass
      const w = 1.25, h = 0.8, cy = CABIN.monitorHeightM + 0.05 - H / 2;
      const top = box(side, H / 2 - (cy + h / 2), 0.1, wall); top.position.y = (H / 2 + cy + h / 2) / 2; face.add(top);
      const bottom = box(side, H / 2 + (cy - h / 2), 0.1, wall); bottom.position.y = (-H / 2 + cy - h / 2) / 2; face.add(bottom);
      for (const sx of [-1, 1]) { const p = box((side - w) / 2, h, 0.1, wall); p.position.set(sx * (w / 2 + (side - w) / 4), cy, 0); face.add(p); }
      for (const [fw, fh, fx, fy] of [[w + 0.12, 0.06, 0, h / 2 + 0.03], [w + 0.12, 0.06, 0, -h / 2 - 0.03], [0.06, h, -w / 2 - 0.03, 0], [0.06, h, w / 2 + 0.03, 0]] as const) {
        const f = box(fw, fh, 0.16, trim); f.position.set(fx, cy + fy, 0.02); face.add(f);
      }
      const glassGeo = new THREE.PlaneGeometry(w, h); made.push(glassGeo);
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.07, roughness: 0.1 }); made.push(glassMat);
      const glass = new THREE.Mesh(glassGeo, glassMat); glass.position.set(0, cy, 0); face.add(glass);
      continue;
    }

    const panel = box(side, H, 0.1, wall); face.add(panel);
    // ribs at the seams between walls
    const rib = box(0.07, H, 0.14, trim); rib.position.set(side / 2, 0, 0.04); face.add(rib);

    if (stationAngles.has(angle)) {
      // monitor housing: a dark slab behind the screen, a bezel, and a small desk under it
      const cy = CABIN.monitorHeightM - H / 2;
      const back = box(SCREEN.widthM + 0.16, SCREEN.heightM + 0.16, 0.06, trim); back.position.set(0, cy, 0.07); face.add(back);
      const screen = box(SCREEN.widthM + 0.02, SCREEN.heightM + 0.02, 0.02, dark); screen.position.set(0, cy, 0.105); face.add(screen);
      const desk = box(SCREEN.widthM + 0.3, 0.05, 0.42, trim); desk.position.set(0, cy - SCREEN.heightM / 2 - 0.2, 0.24); face.add(desk);
      const lip = box(SCREEN.widthM + 0.3, 0.02, 0.02, accent); lip.position.set(0, cy - SCREEN.heightM / 2 - 0.17, 0.45); face.add(lip);
      const lamp = box(SCREEN.widthM * 0.7, 0.03, 0.05, glow); lamp.position.set(0, cy + SCREEN.heightM / 2 + 0.2, 0.1); face.add(lamp);
    } else {
      // plain walls get storage lockers
      for (const y of [-0.55, 0.25]) { const locker = box(side * 0.72, 0.7, 0.05, trim); locker.position.set(0, y, 0.07); face.add(locker);
        const handle = box(0.22, 0.03, 0.03, accent); handle.position.set(0, y + 0.22, 0.11); face.add(handle); }
    }
  }
  // ceiling light strips
  for (const z of [-0.9, 0.9]) { const strip = box(2.4, 0.03, 0.14, glow); strip.position.set(0, H - 0.02, z); group.add(strip); }

  return { group, dispose: () => { for (const d of made) d.dispose(); } };
}
