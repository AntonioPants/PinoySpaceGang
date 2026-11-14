/**
 * The ground the lander actually meets: the elevation grid plus boulders that the grid is too
 * coarse to resolve.
 *
 * 30 m Earth DEMs, 5 m LOLA tiles and even 1 m HiRISE DTMs smooth away most landing-scale rocks,
 * yet rocks are what tip landers over. Orbital data does tell us *how rocky* a place is:
 *   - Moon: LRO Diviner rock abundance (fractional area covered by rocks ≳ 1 m)
 *   - Mars: TES/THEMIS thermal-inertia rock abundance, HiRISE rock counts
 * We turn that single number into a statistically realistic, seeded boulder field with the
 * Golombek & Rapp (1997) rock size-frequency model used to certify every Mars landing site
 * since Pathfinder:
 *
 *     F_k(D) = k · exp(−q(k) · D),   q(k) = 1.79 + 0.152 / k
 *
 * F_k(D) is the fraction of the surface covered by rocks of diameter ≥ D (metres) and k is the
 * total rock abundance. Rock height is taken as half the diameter.
 *
 * If the site carries a roughness grid (roughness_rms_m from extract_profile.py), rock density
 * is scaled locally by that roughness, so rough patches of the DEM get more boulders.
 */
import type { Heightmap, SiteTerrain, Vec2 } from './types.ts';
import { GridTerrain, type HeightField } from './terrain.ts';
import { createRng, type Rng } from './rng.ts';

export interface Rock {
  x: number;
  y: number;
  /** Diameter, m. */
  d: number;
  /** Height above the local ground, m. */
  h: number;
}

/** Golombek & Rapp exponent. */
export function golombekQ(k: number) {
  return 1.79 + 0.152 / k;
}

/** Fraction of area covered by rocks with diameter ≥ D. */
export function cumulativeRockArea(k: number, d: number) {
  return k * Math.exp(-golombekQ(k) * d);
}

/** Expected number of rocks per m² with diameter in [d0, d1]. */
export function rocksPerSquareMetre(k: number, d0: number, d1: number, steps = 64) {
  const q = golombekQ(k);
  let n = 0;
  const dd = (d1 - d0) / steps;
  for (let i = 0; i < steps; i++) {
    const d = d0 + (i + 0.5) * dd;
    n += (k * q * Math.exp(-q * d) * dd) / ((Math.PI * d * d) / 4);
  }
  return n;
}

export interface RockFieldOptions {
  /** Rock abundance k (0..~0.3). Diviner: typical mare ≈ 0.005, fresh crater ejecta ≈ 0.1+. */
  abundance: number;
  /** Centre of the populated area (usually the landing target). */
  center: Vec2;
  /** Half-width of the square populated area, m. */
  radiusM?: number;
  /** Smallest rock generated, m. Rocks below ~0.7 m (0.35 m tall) can't hurt this lander. */
  minDiameterM?: number;
  maxDiameterM?: number;
  /** Optional roughness grid to modulate density locally. */
  roughness?: { map: Heightmap; field: GridTerrain; median: number };
  seed?: number;
}

const CELL = 4; // spatial hash cell, m

export class RockField {
  readonly rocks: Rock[] = [];
  private grid = new Map<number, Rock[]>();

  constructor(opts: RockFieldOptions) {
    const k = Math.min(Math.max(opts.abundance, 0), 0.4);
    if (k <= 0) return;
    const R = opts.radiusM ?? 300;
    const dMin = opts.minDiameterM ?? 0.7;
    const dMax = opts.maxDiameterM ?? 4;
    const rng = createRng(opts.seed ?? 99);
    const area = (2 * R) ** 2;
    const maxMult = opts.roughness ? 4 : 1;
    const bins = 24;
    const step = (dMax - dMin) / bins;
    for (let b = 0; b < bins; b++) {
      const d0 = dMin + b * step;
      const expected = rocksPerSquareMetre(k, d0, d0 + step, 8) * area * maxMult;
      const count = poisson(expected, rng);
      for (let i = 0; i < count; i++) {
        const x = opts.center.x + (rng.next() * 2 - 1) * R;
        const y = opts.center.y + (rng.next() * 2 - 1) * R;
        if (opts.roughness) {
          const local = opts.roughness.field.heightAt(x, y) / opts.roughness.median;
          if (rng.next() * maxMult > clamp(local, 0.2, maxMult)) continue;
        }
        const d = d0 + rng.next() * step;
        this.add({ x, y, d, h: d * (0.4 + 0.2 * rng.next()) });
      }
    }
  }

  private key(ix: number, iy: number) {
    return ix * 73856093 + iy * 19349663;
  }

  private add(r: Rock) {
    this.rocks.push(r);
    const reach = r.d / 2;
    for (let ix = Math.floor((r.x - reach) / CELL); ix <= Math.floor((r.x + reach) / CELL); ix++) {
      for (let iy = Math.floor((r.y - reach) / CELL); iy <= Math.floor((r.y + reach) / CELL); iy++) {
        const k = this.key(ix, iy);
        const list = this.grid.get(k);
        if (list) list.push(r);
        else this.grid.set(k, [r]);
      }
    }
  }

  /** Extra height from rocks at (x, y). */
  heightAt(x: number, y: number): number {
    const list = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(y / CELL)));
    if (!list) return 0;
    let h = 0;
    for (const r of list) {
      const dist = Math.hypot(x - r.x, y - r.y);
      const rad = r.d / 2;
      if (dist < rad) h = Math.max(h, r.h * Math.cos((dist / rad) * (Math.PI / 2)));
    }
    return h;
  }

  /** Tallest rock overlapping the disc of radius `r` around (x, y). */
  maxHeightWithin(x: number, y: number, r: number): number {
    let h = 0;
    const seen = new Set<Rock>();
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++) {
      for (let iy = Math.floor((y - r) / CELL); iy <= Math.floor((y + r) / CELL); iy++) {
        for (const rock of this.grid.get(this.key(ix, iy)) ?? []) {
          if (seen.has(rock)) continue;
          seen.add(rock);
          if (Math.hypot(x - rock.x, y - rock.y) < r + rock.d / 2) h = Math.max(h, rock.h);
        }
      }
    }
    return h;
  }
}

/** Height field that knows about obstacles below its grid resolution. */
export interface HazardField extends HeightField {
  /** Height of the tallest obstacle within radius r of (x, y), above the local ground. */
  obstacleWithin?(x: number, y: number, r: number): number;
}

export class Surface implements HazardField {
  readonly grid: GridTerrain;
  readonly rocks: RockField | null;

  constructor(site: SiteTerrain, opts: { center?: Vec2; seed?: number; rockAbundance?: number } = {}) {
    this.grid = new GridTerrain(site.heightmap);
    const k = opts.rockAbundance ?? site.rockAbundance ?? 0;
    let roughness: RockFieldOptions['roughness'];
    if (site.roughnessGrid) {
      const vals = Array.from(site.roughnessGrid.heights).filter((v) => v > 0).sort((a, b) => a - b);
      const median = vals[Math.floor(vals.length / 2)];
      if (median > 0) roughness = { map: site.roughnessGrid, field: new GridTerrain(site.roughnessGrid), median };
    }
    this.rocks = k > 0 ? new RockField({ abundance: k, center: opts.center ?? { x: 0, y: 0 }, seed: opts.seed, roughness }) : null;
  }

  heightAt(x: number, y: number): number {
    return this.grid.heightAt(x, y) + (this.rocks ? this.rocks.heightAt(x, y) : 0);
  }

  /** Ground without rocks (for camera framing and the altitude reference of the start state). */
  baseHeightAt(x: number, y: number): number {
    return this.grid.heightAt(x, y);
  }

  obstacleWithin(x: number, y: number, r: number): number {
    return this.rocks ? this.rocks.maxHeightWithin(x, y, r) : 0;
  }

  bounds() {
    return this.grid.bounds();
  }
}

function poisson(lambda: number, rng: Rng): number {
  if (lambda <= 0) return 0;
  if (lambda > 50) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * rng.gaussian()));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L);
  return k - 1;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
