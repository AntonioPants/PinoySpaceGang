/** Small helpers for building the bridge in code: shared materials, drawn textures and tracked disposal. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface MatOptions { emissive?: number; glow?: number; metal?: number; rough?: number; /** Smooth shading, for round things. */ smooth?: boolean }

export class Kit {
  private made: Array<{ dispose(): void }> = [];
  private mats = new Map<string, THREE.MeshStandardMaterial>();

  /** A material; the same colour and options return the same material. Faceted unless `smooth`. */
  mat(color: number, o: MatOptions = {}): THREE.MeshStandardMaterial {
    const key = `${color}|${o.emissive ?? ''}|${o.glow ?? ''}|${o.metal ?? ''}|${o.rough ?? ''}|${o.smooth ? 's' : ''}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, flatShading: !o.smooth, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0.05,
        emissive: o.emissive ?? 0x000000, emissiveIntensity: o.glow ?? (o.emissive ? 1 : 0) });
      this.mats.set(key, m); this.made.push(m);
    }
    return m;
  }
  track<T extends { dispose(): void }>(x: T): T { this.made.push(x); return x; }
  /** A texture drawn once on a canvas. */
  texture(width: number, height: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const g = canvas.getContext('2d'); if (g) draw(g, width, height);
    const t = this.track(new THREE.CanvasTexture(canvas)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  /** Meshes cast and receive shadows unless told otherwise. */
  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(this.track(geometry), material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
  }
  box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) { return this.mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z); }
  /** A cylinder or cone (top radius, bottom radius, height). */
  cyl(rt: number, rb: number, h: number, material: THREE.Material, x = 0, y = 0, z = 0, sides = 8) { return this.mesh(new THREE.CylinderGeometry(rt, rb, h, sides), material, x, y, z); }
  dispose() { for (const d of this.made) d.dispose(); this.made = []; this.mats.clear(); }
}

/** Repeatable pseudo-random numbers in 0..1, so the bridge looks the same every time. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Bakes a finished, unmoving group into one mesh per material. The bridge is several hundred
 * small parts; drawn one by one (three times over, with two shadow maps) they halve the frame
 * rate, merged they cost a few dozen draw calls.
 */
export function mergeStatic(group: THREE.Group, kit: Kit): THREE.Group {
  group.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; parts: THREE.BufferGeometry[] }>();
  group.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, b = { material: m.material, cast: m.castShadow, receive: m.receiveShadow, parts: [] });
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    b.parts.push(g.index ? g.toNonIndexed() : g); if (g.index) g.dispose();
  });
  const out = new THREE.Group();
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.parts, false);
    for (const part of b.parts) part.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(kit.track(merged), b.material); mesh.castShadow = b.cast; mesh.receiveShadow = b.receive; out.add(mesh);
  }
  return out;
}
