import * as THREE from "three";

export interface EmitOpts {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  size: [number, number];          // start, end (metres)
  color: [number, number, number, number];     // rgba start
  colorEnd?: [number, number, number, number]; // rgba end (defaults to start, alpha 0)
  drag?: number;                   // 1/s velocity damping
  gravity?: number;                // m/s^2, positive = falls
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec4 aColor;
  varying vec4 vColor;
  uniform float uScale;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  varying vec4 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vColor.a;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor.rgb, a);
  }`;

/** Fixed-size CPU particle pool drawn as soft round points. */
export class Particles {
  readonly points: THREE.Points;
  private n: number;
  private cursor = 0;
  private pos: Float32Array; private vel: Float32Array;
  private life: Float32Array; private maxLife: Float32Array;
  private s0: Float32Array; private s1: Float32Array;
  private c0: Float32Array; private c1: Float32Array;
  private drag: Float32Array; private grav: Float32Array;
  private size: Float32Array; private col: Float32Array;
  private mat: THREE.ShaderMaterial;

  constructor(count: number, additive: boolean) {
    this.n = count;
    this.pos = new Float32Array(count * 3); this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count); this.maxLife = new Float32Array(count).fill(1);
    this.s0 = new Float32Array(count); this.s1 = new Float32Array(count);
    this.c0 = new Float32Array(count * 4); this.c1 = new Float32Array(count * 4);
    this.drag = new Float32Array(count); this.grav = new Float32Array(count);
    this.size = new Float32Array(count); this.col = new Float32Array(count * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 4));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: { uScale: { value: 600 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }

  /** Call on resize: keeps particle size in metres consistent with the camera. */
  setViewport(heightPx: number, fovDeg: number) {
    this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  emit(o: EmitOpts) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
    this.pos.set([o.pos.x, o.pos.y, o.pos.z], i * 3);
    this.vel.set([o.vel.x, o.vel.y, o.vel.z], i * 3);
    this.life[i] = this.maxLife[i] = o.life;
    this.s0[i] = o.size[0]; this.s1[i] = o.size[1];
    this.c0.set(o.color, i * 4);
    this.c1.set(o.colorEnd ?? [o.color[0], o.color[1], o.color[2], 0], i * 4);
    this.drag[i] = o.drag ?? 0; this.grav[i] = o.gravity ?? 0;
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      const damp = Math.max(0, 1 - this.drag[i] * dt);
      const j = i * 3;
      this.vel[j] *= damp; this.vel[j + 2] *= damp;
      this.vel[j + 1] = this.vel[j + 1] * damp - this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      this.size[i] = this.life[i] > 0 ? this.s0[i] + (this.s1[i] - this.s0[i]) * k : 0;
      const c = i * 4;
      for (let q = 0; q < 4; q++) this.col[c + q] = this.c0[c + q] + (this.c1[c + q] - this.c0[c + q]) * k;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.size.fill(0); this.points.geometry.attributes.aSize.needsUpdate = true; }
  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}
