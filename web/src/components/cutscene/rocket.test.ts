import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildLander, GEAR, type LanderSpec } from './lander';
import { buildLaunchPad, buildRocket, PAYLOAD_Y } from './rocket';
import { antennaPackages, solarArrays } from '../../lib/landerAppearance';

/** Exact bounds of the visible geometry (hidden flames excluded; rotated parts not inflated). */
function size(root: THREE.Object3D) {
  const box = new THREE.Box3(), v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverseVisible(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
  });
  return box;
}
/** Largest horizontal distance of any vertex from the vertical axis. */
function radius(root: THREE.Object3D) {
  let r = 0; const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverseVisible(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); r = Math.max(r, Math.hypot(v.x, v.z)); }
  });
  return r;
}
function dispose(root: THREE.Object3D) {
  root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
}

describe('lander gear and arrays', () => {
  it('fold up for the fairing and deploy back to the landing footprint', () => {
    for (const id of Object.keys(GEAR)) {
      const lander = buildLander({ landingGearId: id, solarArrayId: 'extended' });
      const body = lander.group.children[0];
      const open = size(body);
      lander.setGear(0); lander.setArrays(0);
      const folded = size(body);
      expect(folded.min.y).toBeGreaterThan(0.5);                       // feet off the ground
      expect(folded.getSize(new THREE.Vector3()).x).toBeLessThan(open.getSize(new THREE.Vector3()).x);
      lander.setGear(1); lander.setArrays(1);
      const again = size(body);
      expect(again.min.y).toBeCloseTo(0, 5);
      expect(again.max.x).toBeCloseTo(open.max.x, 5);
      dispose(lander.group);
    }
  });
});

describe('hazard sensor', () => {
  it('stays visible outside the payload lander tanks', () => {
    // vertices strictly inside the two side tanks (capsules at z = ±2.05 m, y 2.2–2.8, r 0.48)
    const buried = (spec: LanderSpec) => {
      const lander = buildLander(spec), v = new THREE.Vector3(); let n = 0;
      lander.group.updateMatrixWorld(true);
      lander.group.children[0].traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        const p = o.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
          const y = Math.min(2.8, Math.max(2.2, v.y));
          if (Math.hypot(v.x, v.y - y, Math.abs(v.z) - 2.05) < 0.4) n++;
        }
      });
      dispose(lander.group); return n;
    };
    for (const hazardSensor of ['lidar', 'camera'] as const)
      expect(buried({ vehicleId: 'payload', hazardSensor })).toBe(buried({ vehicleId: 'payload', hazardSensor: 'none' }));
  });
});

describe('buildRocket', () => {
  it('holds every folded lander inside its fairing', () => {
    for (const vehicleId of ['survey', 'payload']) for (const landingGearId of Object.keys(GEAR))
      for (const solar of solarArrays) for (const antenna of antennaPackages) {
        const spec: LanderSpec = { vehicleId, landingGearId, solarArrayId: solar.id, antennaId: antenna.id, hazardSensor: 'lidar' };
        const lander = buildLander(spec); lander.setGear(0); lander.setArrays(0);
        const b = size(lander.group.children[0]);
        expect(radius(lander.group.children[0])).toBeLessThan(3.1);      // fairing inner radius 3.15 m
        expect(b.min.y).toBeGreaterThanOrEqual(-0.01);                    // sits on the payload adapter
        expect(PAYLOAD_Y + b.max.y).toBeLessThan(39.6);                   // below the start of the nose
        dispose(lander.group);
      }
  });

  it('separates and resets its boosters, fairing and core', () => {
    const rocket = buildRocket({ liveryId: 'ember' }), scene = new THREE.Scene();
    scene.add(rocket.group);
    expect(rocket.boosters).toHaveLength(4);
    expect(rocket.boosterNozzles).toHaveLength(4);
    rocket.setFairing(1);
    const opened = rocket.fairing[0].pivot.quaternion.clone();
    expect(opened.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.5);
    for (const part of [rocket.core, ...rocket.boosters, ...rocket.fairing.map(f => f.pivot)]) { scene.attach(part); part.position.y -= 50; }
    expect(rocket.group.children).toHaveLength(0);
    rocket.reset();
    expect(rocket.group.children).toHaveLength(1 + 4 + 2);
    expect(rocket.fairing[0].pivot.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0, 6);
    expect(size(rocket.group).min.y).toBeCloseTo(0, 1);
    let meshes = 0; rocket.group.traverse(o => { if (o instanceof THREE.Mesh) meshes++; });
    expect(meshes).toBeLessThanOrEqual(14);                            // 7 parts and 5 flames
    dispose(rocket.group);
  });

  it('builds a launch pad whose top is at ground level', () => {
    const pad = buildLaunchPad(1);
    expect(size(pad).max.y).toBeGreaterThan(45);                       // the service tower
    let meshes = 0; pad.traverse(o => { if (o instanceof THREE.Mesh) meshes++; });
    expect(meshes).toBe(1);
    dispose(pad);
  });
});
