import type { Heightmap, SiteTerrain, Body, Vec2, Vec3 } from './types.ts';
import { createRng, hash2 } from './rng.ts';

/** Anything that can report ground elevation at a world (x, y). */
export interface HeightField {
  heightAt(x: number, y: number): number;
}

/** Bilinear sampler over a heightmap; positions outside the grid clamp to the edge. */
export class GridTerrain implements HeightField {
  readonly originX: number;
  readonly originY: number;
  constructor(readonly map: Heightmap) {
    if (map.heights.length !== map.cols * map.rows) {
      throw new Error(`heightmap has ${map.heights.length} values, expected ${map.cols * map.rows}`);
    }
    this.originX = map.originX ?? -((map.cols - 1) * map.cellSize) / 2;
    this.originY = map.originY ?? -((map.rows - 1) * map.cellSize) / 2;
  }

  heightAt(x: number, y: number): number {
    const { cols, rows, cellSize, heights } = this.map;
    const fx = clamp((x - this.originX) / cellSize, 0, cols - 1);
    const fy = clamp((y - this.originY) / cellSize, 0, rows - 1);
    const c0 = Math.min(Math.floor(fx), cols - 2 < 0 ? 0 : cols - 2);
    const r0 = Math.min(Math.floor(fy), rows - 2 < 0 ? 0 : rows - 2);
    const c1 = Math.min(c0 + 1, cols - 1);
    const r1 = Math.min(r0 + 1, rows - 1);
    const tx = fx - c0;
    const ty = fy - r0;
    const h00 = heights[r0 * cols + c0];
    const h10 = heights[r0 * cols + c1];
    const h01 = heights[r1 * cols + c0];
    const h11 = heights[r1 * cols + c1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
  }

  bounds() {
    return {
      minX: this.originX,
      minY: this.originY,
      maxX: this.originX + (this.map.cols - 1) * this.map.cellSize,
      maxY: this.originY + (this.map.rows - 1) * this.map.cellSize,
    };
  }
}

/** Ground gradient measured across the lander's footprint (radius r). */
export function gradientAt(f: HeightField, x: number, y: number, r: number): Vec2 {
  return {
    x: (f.heightAt(x + r, y) - f.heightAt(x - r, y)) / (2 * r),
    y: (f.heightAt(x, y + r) - f.heightAt(x, y - r)) / (2 * r),
  };
}

export function normalAt(f: HeightField, x: number, y: number, r: number): Vec3 {
  const g = gradientAt(f, x, y, r);
  const len = Math.hypot(g.x, g.y, 1);
  return { x: -g.x / len, y: -g.y / len, z: 1 / len };
}

export function slopeDegAt(f: HeightField, x: number, y: number, r: number): number {
  const g = gradientAt(f, x, y, r);
  return (Math.atan(Math.hypot(g.x, g.y)) * 180) / Math.PI;
}

/**
 * Largest deviation of points on the leg circle (and the centre) from the best local plane:
 * catches boulders and crater rims that a slope estimate averages away.
 */
export function roughnessAt(f: HeightField, x: number, y: number, r: number): number {
  const g = gradientAt(f, x, y, r);
  const pts: Array<[number, number]> = [[0, 0]];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
    pts.push([0.5 * r * Math.cos(a + Math.PI / 8), 0.5 * r * Math.sin(a + Math.PI / 8)]);
  }
  const res = pts.map(([dx, dy]) => f.heightAt(x + dx, y + dy) - (g.x * dx + g.y * dy));
  const mean = res.reduce((s, v) => s + v, 0) / res.length;
  return Math.max(...res.map((v) => Math.abs(v - mean)));
}

/** Wraps a height field with spatially consistent measurement noise (e.g. a glare-blinded camera). */
export function noisyField(
  f: HeightField & { obstacleWithin?(x: number, y: number, r: number): number },
  sigmaM: number,
  seed: number,
  cellM = 1,
): HeightField & { obstacleWithin?(x: number, y: number, r: number): number } {
  if (sigmaM <= 0) return f;
  return {
    // a blinded sensor misses obstacles that are small compared with its noise
    obstacleWithin: f.obstacleWithin
      ? (x, y, r) => {
          const h = f.obstacleWithin!(x, y, r);
          return h > sigmaM * 0.8 ? h : 0;
        }
      : undefined,
    heightAt(x, y) {
      // bilinear value noise so slopes stay finite between lattice points
      const fx = x / cellM;
      const fy = y / cellM;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const n =
        (hash2(ix, iy, seed) * (1 - tx) + hash2(ix + 1, iy, seed) * tx) * (1 - ty) +
        (hash2(ix, iy + 1, seed) * (1 - tx) + hash2(ix + 1, iy + 1, seed) * tx) * ty;
      return f.heightAt(x, y) + n * sigmaM * 1.7;
    },
  };
}

export interface SyntheticTerrainOptions {
  id?: string;
  body?: Body;
  analogOf?: Exclude<Body, 'earth'>;
  /** Side length of the square map, metres. */
  sizeM?: number;
  cellSize?: number;
  seed?: number;
  /** Amplitude of rolling hills, metres. */
  hillsM?: number;
  /** Uniform regional slope towards +x, degrees. */
  baseSlopeDeg?: number;
  craters?: number;
  /** Boulder fields: centre, radius and count. */
  boulderFields?: Array<{ center: Vec2; radiusM: number; count: number; sizeM?: number }>;
  wind?: Vec2;
}

/**
 * Procedural terrain for development and tests, until Yousef & Antonio's real elevation
 * slices are in sites.json.
 */
export function syntheticTerrain(opts: SyntheticTerrainOptions = {}): SiteTerrain {
  const sizeM = opts.sizeM ?? 1200;
  const cellSize = opts.cellSize ?? 1;
  const seed = opts.seed ?? 7;
  const n = Math.round(sizeM / cellSize) + 1;
  const heights = new Float32Array(n * n);
  const origin = -((n - 1) * cellSize) / 2;
  const rng = createRng(seed);
  const hills = opts.hillsM ?? 4;
  const tanBase = Math.tan(((opts.baseSlopeDeg ?? 0) * Math.PI) / 180);

  const craters = Array.from({ length: opts.craters ?? 0 }, () => ({
    x: (rng.next() - 0.5) * sizeM * 0.8,
    y: (rng.next() - 0.5) * sizeM * 0.8,
    r: 15 + rng.next() * 50,
  }));
  const boulders: Array<{ x: number; y: number; h: number; s: number }> = [];
  for (const field of opts.boulderFields ?? []) {
    for (let i = 0; i < field.count; i++) {
      const a = rng.next() * 2 * Math.PI;
      const d = Math.sqrt(rng.next()) * field.radiusM;
      const size = (field.sizeM ?? 1.5) * (0.6 + rng.next() * 0.8);
      boulders.push({ x: field.center.x + d * Math.cos(a), y: field.center.y + d * Math.sin(a), h: size, s: size });
    }
  }

  const smooth = (x: number, y: number, wavelength: number, s: number) => {
    const fx = x / wavelength;
    const fy = y / wavelength;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    return (
      (hash2(ix, iy, s) * (1 - sx) + hash2(ix + 1, iy, s) * sx) * (1 - sy) +
      (hash2(ix, iy + 1, s) * (1 - sx) + hash2(ix + 1, iy + 1, s) * sx) * sy
    );
  };

  for (let r = 0; r < n; r++) {
    const y = origin + r * cellSize;
    for (let c = 0; c < n; c++) {
      const x = origin + c * cellSize;
      let h = x * tanBase;
      h += hills * (smooth(x, y, 300, seed) + 0.4 * smooth(x, y, 90, seed + 1));
      for (const k of craters) {
        const d = Math.hypot(x - k.x, y - k.y) / k.r;
        if (d < 1) h -= 0.2 * k.r * (1 - d * d);
        else if (d < 1.4) h += 0.05 * k.r * Math.cos(((d - 1) / 0.4) * (Math.PI / 2));
      }
      for (const b of boulders) {
        const dx = x - b.x;
        const dy = y - b.y;
        if (Math.abs(dx) < 4 * b.s && Math.abs(dy) < 4 * b.s) {
          h += b.h * Math.exp(-(dx * dx + dy * dy) / (2 * (b.s / 2) ** 2));
        }
      }
      heights[r * n + c] = h;
    }
  }

  return {
    id: opts.id ?? 'synthetic',
    name: 'Synthetic test terrain',
    body: opts.body ?? 'moon',
    analogOf: opts.analogOf,
    heightmap: { cols: n, rows: n, cellSize, heights, originX: origin, originY: origin },
    wind: opts.wind ?? { x: 0, y: 0 },
  };
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
