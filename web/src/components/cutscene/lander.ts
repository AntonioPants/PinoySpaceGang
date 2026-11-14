import * as THREE from "three";

/** Which hardware to draw. Plain ids so the cutscene layer does not depend on the game's catalog. */
export interface LanderSpec { vehicleId?: string; landingGearId?: string; hazardSensor?: 'lidar' | 'camera' | 'none' }

/** Footprint of each landing gear option: leg count, foot-circle radius and pad radius, in metres. */
const GEAR: Record<string, { legs: number; radius: number; pad: number }> = {
  'standard-four': { legs: 4, radius: 3, pad: 0.42 },
  'wide-four': { legs: 4, radius: 3.8, pad: 0.55 },
  'survey-six': { legs: 6, radius: 3.3, pad: 0.5 },
};

export interface Lander {
  group: THREE.Group;          // origin = foot level, +Y up
  flame: THREE.Mesh;           // scale.y / visibility driven by throttle
  mast: THREE.Group;           // beacon mast, scale.y 0..1
  beaconTip: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  nozzleY: number;
  debrisColors: number[];
  /** The gear the model was built with. Its feet are radius.. metres from the axis, so effects can follow it. */
  footRadius: number;
}

function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const dir = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 6), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/** Procedural test lander, about 4 m tall. Generic design: no agency markings. */
export function buildLander(spec: LanderSpec = {}): Lander {
  const g = new THREE.Group();
  const payload = spec.vehicleId === 'payload';
  const gear = GEAR[spec.landingGearId ?? ''] ?? GEAR['standard-four'];
  const foil = new THREE.MeshStandardMaterial({ color: payload ? 0xb8bcc4 : 0xd9ae2e, metalness: 0.35, roughness: 0.5, flatShading: true });
  const white = new THREE.MeshStandardMaterial({ color: 0xe7e7ea, metalness: 0.2, roughness: 0.6, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3d45, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide });
  const panel = new THREE.MeshStandardMaterial({ color: 0x1f47a0, metalness: 0.3, roughness: 0.35 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xc8553d, metalness: 0.3, roughness: 0.5, flatShading: true });

  // Payload lander: a taller, wider hull with a wider engine bell and two external propellant tanks.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(payload ? 1.75 : 1.5, payload ? 1.95 : 1.7, payload ? 1.75 : 1.4, 8), foil); body.position.y = payload ? 2.35 : 2.2; g.add(body);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(payload ? 1.2 : 1.0, payload ? 1.55 : 1.3, 0.9, 8), white); upper.position.y = payload ? 3.65 : 3.35; g.add(upper);
  const bell = new THREE.Mesh(new THREE.ConeGeometry(payload ? 0.95 : 0.75, 1.0, 16, 1, true), dark); bell.position.y = 1.15; g.add(bell);
  if (payload) {
    for (const sz of [-1, 1]) {
      const tank = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), white); tank.position.set(0, 2.45, sz * 2.25); g.add(tank);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.12, 14), accent); band.position.copy(tank.position); g.add(band);
      g.add(strut(new THREE.Vector3(0, 2.45, sz * 1.8), new THREE.Vector3(0, 2.45, sz * 1.75), 0.06, dark));
    }
  }

  // Landing gear: leg count, stance and pad size follow the selected option.
  for (let k = 0; k < gear.legs; k++) {
    const a = Math.PI / gear.legs + (k * 2 * Math.PI) / gear.legs, cx = Math.cos(a), sz = Math.sin(a);
    const foot = new THREE.Vector3(cx * gear.radius, 0.12, sz * gear.radius);
    g.add(strut(new THREE.Vector3(cx * 1.5, 2.6, sz * 1.5), foot, 0.07, white));
    g.add(strut(new THREE.Vector3(cx * 1.6, 1.6, sz * 1.6), foot, 0.05, white));
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(gear.pad * 0.9, gear.pad, 0.1, 10), dark); pad.position.set(foot.x, 0.05, foot.z); g.add(pad);
  }
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 1.1), panel); p.position.set(sx * 2.55, payload ? 3.3 : 3.0, 0); p.rotation.z = sx * -0.25; g.add(p);
  }
  const dishY = payload ? 4.35 : 4.05;
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.25, 16, 1, true), white); dish.position.set(0.55, dishY, 0.3); dish.rotation.set(Math.PI, 0, 0.5); g.add(dish);

  // Hazard sensor: a lidar drum, a camera box, or nothing, on the hull facing the ground track.
  if (spec.hazardSensor && spec.hazardSensor !== 'none') {
    const mat = new THREE.MeshStandardMaterial({ color: 0xa7c2c4, emissive: 0x254548, metalness: 0.7, roughness: 0.2 });
    const sensor = new THREE.Mesh(spec.hazardSensor === 'camera' ? new THREE.BoxGeometry(0.5, 0.35, 0.4) : new THREE.CylinderGeometry(0.22, 0.22, 0.4, 16), mat);
    sensor.position.set(0, payload ? 3.85 : 3.5, payload ? 1.4 : 1.1); g.add(sensor);
  }

  const mastY = payload ? 4.2 : 3.8;
  const mast = new THREE.Group(); mast.position.y = mastY; mast.scale.y = 0.001; g.add(mast);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.4, 6), white); rod.position.y = 1.2; mast.add(rod);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x113322, fog: false });
  const beaconTip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), beaconMat); beaconTip.position.y = 2.45; mast.add(beaconTip);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(payload ? 0.75 : 0.6, 3.4, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  flame.geometry.rotateX(Math.PI); flame.geometry.translate(0, -1.7, 0);   // apex down, top at origin
  flame.position.y = 0.7; flame.visible = false; g.add(flame);

  return { group: g, flame, mast, beaconTip, beaconMat, nozzleY: 0.7, footRadius: gear.radius,
    debrisColors: [payload ? 0xb8bcc4 : 0xc9a227, 0xe7e7ea, 0x2b2d33, payload ? 0xc8553d : 0x16306b] };
}
