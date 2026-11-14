/**
 * What the porthole shows: the surface of the body the mission departs from. It is generated in
 * code from the cutscene module's lunar and Mars colour presets. An illustration, not a view of
 * the selected site: the catalogue's planetary terrain is far too coarse to stand on.
 */
import * as THREE from 'three';
import { PRESETS } from '../../components/cutscene';

export function buildExterior(body: 'Moon' | 'Mars'): { group: THREE.Group; sky: THREE.Color; fog: THREE.Fog | null; sunDirection: THREE.Vector3; dispose: () => void } {
  const look = body === 'Moon' ? PRESETS.lunar : PRESETS.mars;
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  // rolling ground with a few crater-like dips, coloured between the preset's two ground tones
  const size = 900, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const light = new THREE.Color(look.ground), dark = new THREE.Color(look.groundDark), c = new THREE.Color();
  const craters = Array.from({ length: 26 }, (_, i) => {
    const a = i * 2.399963, r = 30 + ((i * 53) % 330);
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, rad: 8 + ((i * 17) % 30) };
  });
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let h = 2.2 * Math.sin(x * 0.021) * Math.cos(z * 0.017) + 1.1 * Math.sin(x * 0.07 + 1.3) * Math.sin(z * 0.063) + 6 * Math.sin((x + z) * 0.004);
    for (const k of craters) {
      const d = Math.hypot(x - k.x, z - k.z) / k.rad;
      if (d < 1) h -= k.rad * 0.16 * (1 - d * d); else if (d < 1.35) h += k.rad * 0.04 * (1.35 - d) / 0.35;
    }
    const near = Math.hypot(x, z) < 14 ? 0 : 1;       // flat where the lander stands
    pos.setY(i, h * near);
    c.copy(dark).lerp(light, Math.min(1, Math.max(0, 0.55 + h * 0.07)));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(geo, groundMat); ground.position.y = -1.6;       // the cabin floor is above the surface
  group.add(ground); disposables.push(geo, groundMat);

  // scattered rocks
  const rockGeo = new THREE.DodecahedronGeometry(1, 0), rockMat = new THREE.MeshStandardMaterial({ color: look.rock, roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 160);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < 160; i++) {
    const a = i * 2.39996 + 0.7, r = 9 + ((i * 37) % 170);
    const k = 0.15 + ((i * 13) % 10) / 14;
    p.set(Math.cos(a) * r, -1.6 + k * 0.3, Math.sin(a) * r); s.set(k, k * 0.7, k); q.setFromEuler(new THREE.Euler(i, i * 2, i * 3));
    rocks.setMatrixAt(i, m.compose(p, q, s));
  }
  group.add(rocks); disposables.push(rockGeo, rockMat);

  if (look.stars) {
    const starGeo = new THREE.BufferGeometry(), n = 700, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = (i * 0.61803398875) % 1, v = (i * 0.75487766625) % 1;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);        // upper hemisphere
      sp.set([Math.sin(ph) * Math.cos(th) * 800, Math.cos(ph) * 800 + 10, Math.sin(ph) * Math.sin(th) * 800], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false });
    group.add(new THREE.Points(starGeo, starMat)); disposables.push(starGeo, starMat);
  }

  return {
    group,
    sky: new THREE.Color(look.stars ? look.skyTop : look.skyHorizon),
    fog: look.stars ? null : new THREE.Fog(look.fog, 60, 520),
    sunDirection: new THREE.Vector3(-0.75, 0.42, -0.5).normalize(),
    dispose: () => { for (const d of disposables) d.dispose(); },
  };
}
