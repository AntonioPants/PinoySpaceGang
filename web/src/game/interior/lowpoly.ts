/** Small helpers for the bridge's low-poly look: flat-shaded materials and tracked disposal. */
import * as THREE from 'three';

export class Kit {
  private made: Array<{ dispose(): void }> = [];
  private mats = new Map<string, THREE.MeshStandardMaterial>();

  /** A flat-shaded material; the same colour and options return the same material. */
  mat(color: number, o: { emissive?: number; glow?: number; metal?: number; rough?: number } = {}): THREE.MeshStandardMaterial {
    const key = `${color}|${o.emissive ?? ''}|${o.glow ?? ''}|${o.metal ?? ''}|${o.rough ?? ''}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0.1,
        emissive: o.emissive ?? 0x000000, emissiveIntensity: o.glow ?? (o.emissive ? 1 : 0) });
      this.mats.set(key, m); this.made.push(m);
    }
    return m;
  }
  track<T extends { dispose(): void }>(x: T): T { this.made.push(x); return x; }
  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(this.track(geometry), material); m.position.set(x, y, z); return m;
  }
  box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) { return this.mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z); }
  /** A faceted cylinder or cone (top radius, bottom radius, height). */
  cyl(rt: number, rb: number, h: number, material: THREE.Material, x = 0, y = 0, z = 0, sides = 8) { return this.mesh(new THREE.CylinderGeometry(rt, rb, h, sides), material, x, y, z); }
  dispose() { for (const d of this.made) d.dispose(); this.made = []; this.mats.clear(); }
}
