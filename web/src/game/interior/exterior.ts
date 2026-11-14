/**
 * What is outside the windows: space. Stars, the body the mission departs from and a distant
 * Earth, lit by one Sun. The bodies wear real NASA imagery (see
 * web/public/textures/bridge/SOURCES.md) but the scene is an illustration: sizes, distances
 * and the trip itself are for looks, and nothing here shows the selected sites.
 */
import * as THREE from 'three';
import { Kit, seeded } from './lowpoly';

const TEXTURES = '/textures/bridge/';

const BODY_VERT = /* glsl */`
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewW;
  void main() {
    vUv = uv; vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0); vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
// sunlit side from the image, a soft terminator, and an almost black night side
const BODY_FRAG = /* glsl */`
  uniform sampler2D map; uniform vec3 sun; uniform float gain;
  varying vec2 vUv; varying vec3 vNormalW;
  void main() {
    float lit = smoothstep(-0.05, 0.35, dot(normalize(vNormalW), sun));
    gl_FragColor = vec4(texture2D(map, vUv).rgb * (lit * gain + 0.004), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// a thin band of scattered light at the limb, brightest on the day side
const AIR_FRAG = /* glsl */`
  uniform vec3 sun; uniform vec3 tint;
  varying vec3 vNormalW; varying vec3 vViewW;
  void main() {
    vec3 n = normalize(vNormalW);
    float rim = pow(clamp(1.0 + dot(n, normalize(vViewW)), 0.0, 1.0), 2.5);   // back faces: strongest at the edge
    float day = smoothstep(-0.25, 0.5, dot(-n, sun));
    gl_FragColor = vec4(tint * rim * day * 1.6, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function buildSpace(body: 'Moon' | 'Mars'): { group: THREE.Group; sunDirection: THREE.Vector3; drift(dt: number): void; dispose(): void } {
  const kit = new Kit(), group = new THREE.Group();
  // toward the Sun: off to the right and a little ahead, so it shines in through the window
  const sunDirection = new THREE.Vector3(0.8, 0.45, -0.4).normalize();
  const loader = new THREE.TextureLoader();
  const blank = kit.track(new THREE.DataTexture(new Uint8Array([90, 90, 90, 255]), 1, 1)); blank.needsUpdate = true;
  let gone = false;

  const globe = (file: string, radius: number, gain: number) => {
    const uniforms = { map: { value: blank as THREE.Texture }, sun: { value: sunDirection }, gain: { value: gain } };
    const mat = kit.track(new THREE.ShaderMaterial({ uniforms, vertexShader: BODY_VERT, fragmentShader: BODY_FRAG }));
    loader.load(TEXTURES + file, t => {
      if (gone) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; kit.track(t); uniforms.map.value = t;
    });
    const m = kit.mesh(new THREE.SphereGeometry(radius, 96, 64), mat); m.castShadow = m.receiveShadow = false;
    return m;
  };

  // stars: sparse, small, nearly all faint
  const rnd = seeded(11), count = 1100, p = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(1 - 2 * rnd()), r = 1800;
    p.set([Math.sin(ph) * Math.cos(th) * r, Math.cos(ph) * r, Math.sin(ph) * Math.sin(th) * r], i * 3);
    const b = 0.12 + 0.88 * Math.pow(rnd(), 5), warm = (rnd() - 0.5) * 0.12;
    col.set([b * (1 + warm), b, b * (1 - warm)], i * 3);
  }
  const starGeo = kit.track(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  group.add(new THREE.Points(starGeo, kit.track(new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, fog: false }))));

  // the departure body, large and falling behind to the lower left; Earth small and ahead
  const home = globe(body === 'Moon' ? 'moon.jpg' : 'mars.jpg', 420, body === 'Moon' ? 1.5 : 1.7);
  home.position.set(-520, -330, -820); home.rotation.set(0.3, 1.2, 0.1); group.add(home);
  const earth = globe('earth.jpg', 46, 2.0);
  earth.position.set(-60, 205, -1150); earth.rotation.set(0.41, 3.6, 0); group.add(earth);
  const air = kit.mesh(new THREE.SphereGeometry(46 * 1.035, 64, 48), kit.track(new THREE.ShaderMaterial({
    uniforms: { sun: { value: sunDirection }, tint: { value: new THREE.Color(0x6aa8ff) } }, vertexShader: BODY_VERT, fragmentShader: AIR_FRAG,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  air.castShadow = air.receiveShadow = false; air.position.copy(earth.position); group.add(air);

  return {
    group, sunDirection,
    drift(dt) { home.rotation.y += dt * 0.004; earth.rotation.y += dt * 0.02; },
    dispose: () => { gone = true; kit.dispose(); },
  };
}
