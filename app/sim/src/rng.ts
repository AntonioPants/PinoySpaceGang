/** Seeded RNG (mulberry32) so every run is reproducible from its seed. */
export interface Rng {
  next(): number;
  gaussian(): number;
}

export function createRng(seed = 1): Rng {
  let a = seed >>> 0;
  let spare: number | undefined;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gaussian = () => {
    if (spare !== undefined) {
      const s = spare;
      spare = undefined;
      return s;
    }
    const u = Math.max(next(), 1e-12);
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  return { next, gaussian };
}

/** Deterministic pseudo-random value in [-1, 1] for an integer lattice point. */
export function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
