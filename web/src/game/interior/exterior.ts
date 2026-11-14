/**
 * What is outside the windows: space. Stars, the body the mission departs from, a distant Earth
 * ahead, and the Sun's light. The trip is the game's framing, not a simulated trajectory, so
 * sizes and distances here are for looks only.
 */
import * as THREE from 'three';
import { Kit } from './lowpoly';

/** A faceted globe whose faces vary in tone, for the low-poly look. */
function planet(kit: Kit, radius: number, colors: number[], detail: number, seed: number): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(radius, detail).toNonIndexed();
  const pos = geo.attributes.position as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const palette = colors.map(c => new THREE.Color(c)), c = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const x = pos.getX(f) / radius, y = pos.getY(f) / radius, z = pos.getZ(f) / radius;
    const n = Math.sin(x * 5.1 + seed) * Math.cos(y * 4.3 - seed) + Math.sin(z * 6.7 + seed * 2) * 0.6 + Math.sin((x + y + z) * 11) * 0.25;
    const i = Math.max(0, Math.min(palette.length - 1.001, (n + 1.6) / 3.2 * (palette.length - 1)));
    c.copy(palette[Math.floor(i)]).lerp(palette[Math.floor(i) + 1], i % 1);
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mat = kit.track(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
  return kit.mesh(geo, mat);
}

export function buildSpace(body: 'Moon' | 'Mars'): { group: THREE.Group; sunDirection: THREE.Vector3; drift(dt: number): void; dispose(): void } {
  const kit = new Kit(), group = new THREE.Group();

  // stars: two sizes, a few tinted
  for (const [count, size, seed] of [[2600, 1.4, 1], [320, 2.6, 7]] as const) {
    const p = new Float32Array(count * 3), col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = ((i + seed) * 0.61803398875) % 1, v = ((i + seed) * 0.75487766625) % 1;
      const th = u * Math.PI * 2, ph = Math.acos(1 - 2 * v), r = 1800;
      p.set([Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r, Math.sin(ph) * Math.sin(th) * r], i * 3);
      const tint = i % 9 === 0 ? [1, 0.82, 0.66] : i % 7 === 0 ? [0.7, 0.84, 1] : [1, 1, 1], b = 0.55 + ((i * 37) % 45) / 100;
      col.set([tint[0] * b, tint[1] * b, tint[2] * b], i * 3);
    }
    const geo = kit.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    group.add(new THREE.Points(geo, kit.track(new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, fog: false }))));
  }

  // the departure body, large and falling behind to the lower left; Earth small and ahead
  const home = body === 'Moon'
    ? planet(kit, 420, [0x4b4e55, 0x7c8089, 0xa9adb5, 0xd2d5da], 4, 1.3)
    : planet(kit, 420, [0x6e3620, 0x9a4c2b, 0xc06a3c, 0xe0976a], 4, 2.1);
  home.position.set(-520, -330, -820); group.add(home);
  const earth = planet(kit, 46, [0x1d4f9c, 0x2f7ac4, 0x3c9a5a, 0xe9f1f6], 3, 4.2);
  earth.position.set(250, 120, -1150); group.add(earth);
  const haze = kit.mesh(new THREE.IcosahedronGeometry(50, 2), kit.track(new THREE.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true, opacity: 0.18 })));
  haze.position.copy(earth.position); group.add(haze);

  return {
    group, sunDirection: new THREE.Vector3(0.55, 0.35, -0.75).normalize(),
    drift(dt) { home.rotation.y += dt * 0.012; earth.rotation.y += dt * 0.05; group.rotation.z += dt * 0.0015; },
    dispose: () => kit.dispose(),
  };
}
