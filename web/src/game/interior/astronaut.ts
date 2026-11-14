/**
 * The player's character: a low-poly astronaut built from a few faceted shapes, with a walk
 * cycle, an idle sway and a seated pose. Generated in code; no model file.
 */
import * as THREE from 'three';
import { Kit } from './lowpoly';

export interface Astronaut {
  group: THREE.Group;
  /** speed 0..1 drives the walk cycle; seated bends the legs onto a chair. */
  animate(dt: number, speed: number, seated: boolean): void;
  dispose(): void;
}

export function buildAstronaut(): Astronaut {
  const kit = new Kit();
  const suit = kit.mat(0xf2f4f7, { rough: 0.7 }), shade = kit.mat(0xc9d0da), pack = kit.mat(0x8f9aaa, { metal: 0.3 });
  const orange = kit.mat(0xff7a3d), dark = kit.mat(0x2a303a), visor = kit.mat(0xffc65a, { metal: 0.9, rough: 0.15, emissive: 0x7a4a08, glow: 0.5 });
  const light = kit.mat(0x7ff3ff, { emissive: 0x7ff3ff, glow: 1.6 });

  const group = new THREE.Group();
  const body = new THREE.Group(); group.add(body);                    // everything above the feet; bobs while walking

  // torso, with a chest pack and a life-support backpack (the astronaut faces -z)
  const torso = kit.box(0.56, 0.62, 0.36, suit, 0, 1.13, 0); body.add(torso);
  body.add(kit.box(0.6, 0.12, 0.4, shade, 0, 0.79, 0));               // belt
  body.add(kit.box(0.3, 0.22, 0.08, pack, 0, 1.2, -0.21));            // chest control box
  body.add(kit.box(0.06, 0.06, 0.02, light, -0.08, 1.24, -0.255), kit.box(0.06, 0.06, 0.02, orange, 0.06, 1.24, -0.255));
  body.add(kit.box(0.5, 0.7, 0.24, pack, 0, 1.18, 0.3));              // backpack
  body.add(kit.box(0.14, 0.14, 0.05, light, 0, 1.38, 0.43));
  body.add(kit.cyl(0.03, 0.03, 0.3, dark, 0.2, 1.62, 0.36, 5));       // antenna
  for (const sx of [-1, 1]) body.add(kit.box(0.2, 0.12, 0.4, orange, sx * 0.3, 1.42, 0.02)); // shoulder flashes

  // helmet: faceted globe, gold visor, collar ring
  const head = new THREE.Group(); head.position.set(0, 1.66, 0); body.add(head);
  head.add(kit.mesh(new THREE.IcosahedronGeometry(0.31, 1), suit));
  const face = kit.mesh(new THREE.SphereGeometry(0.255, 7, 5, 0, Math.PI * 2, 0.35, 1.25), visor, 0, 0.0, -0.105); face.rotation.x = -Math.PI / 2; head.add(face);
  body.add(kit.cyl(0.24, 0.27, 0.09, shade, 0, 1.44, 0, 10));

  // limbs: each hangs from a pivot so it can swing
  const limb = (x: number, y: number, upper: [number, number], lower: [number, number], endMat: THREE.Material, endSize: [number, number, number]) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    pivot.add(kit.cyl(upper[0], upper[0] * 0.9, upper[1], suit, 0, -upper[1] / 2, 0, 7));
    const joint = new THREE.Group(); joint.position.y = -upper[1]; pivot.add(joint);
    joint.add(kit.cyl(0.07, 0.07, 0.05, orange, 0, 0, 0, 7));          // coloured band at the joint
    joint.add(kit.cyl(lower[0], lower[0] * 0.95, lower[1], suit, 0, -lower[1] / 2, 0, 7));
    joint.add(kit.box(endSize[0], endSize[1], endSize[2], endMat, 0, -lower[1] - endSize[1] / 2 + 0.02, endSize[2] > 0.2 ? -0.05 : 0));
    return { pivot, joint };
  };
  const armL = limb(-0.37, 1.38, [0.09, 0.3], [0.08, 0.28], dark, [0.13, 0.13, 0.13]);
  const armR = limb(0.37, 1.38, [0.09, 0.3], [0.08, 0.28], dark, [0.13, 0.13, 0.13]);
  const legL = limb(-0.15, 0.76, [0.11, 0.36], [0.1, 0.32], shade, [0.2, 0.12, 0.32]);
  const legR = limb(0.15, 0.76, [0.11, 0.36], [0.1, 0.32], shade, [0.2, 0.12, 0.32]);
  body.add(armL.pivot, armR.pivot); group.add(legL.pivot, legR.pivot);
  armL.pivot.rotation.z = -0.1; armR.pivot.rotation.z = 0.1;

  let phase = 0, sit = 0, t = 0;
  return {
    group,
    animate(dt, speed, seated) {
      t += dt; phase += dt * 8.5 * speed;
      sit += ((seated ? 1 : 0) - sit) * Math.min(1, dt * 7);
      const swing = Math.sin(phase) * 0.75 * speed * (1 - sit);
      // walking: opposite arm and leg swing together, knees and elbows bend on the back swing
      legL.pivot.rotation.x = swing - sit * 1.5; legR.pivot.rotation.x = -swing - sit * 1.5;
      legL.joint.rotation.x = -Math.max(0, -Math.sin(phase)) * 0.9 * speed * (1 - sit) + sit * 1.5;
      legR.joint.rotation.x = -Math.max(0, Math.sin(phase)) * 0.9 * speed * (1 - sit) + sit * 1.5;
      armL.pivot.rotation.x = -swing * 0.8 - sit * 0.95; armR.pivot.rotation.x = swing * 0.8 - sit * 0.95;
      armL.joint.rotation.x = 0.25 * speed + sit * 0.5; armR.joint.rotation.x = 0.25 * speed + sit * 0.5;
      // a small bob while walking, a slow breath while standing, and settle onto the seat
      body.position.y = Math.abs(Math.sin(phase)) * 0.045 * speed + Math.sin(t * 1.7) * 0.008 * (1 - speed) - sit * 0.24;
      legL.pivot.position.y = legR.pivot.position.y = 0.76 - sit * 0.24;
      head.rotation.y = Math.sin(t * 0.6) * 0.12 * (1 - speed);
    },
    dispose: () => kit.dispose(),
  };
}
