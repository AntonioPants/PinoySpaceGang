// Terrain descriptors for a 33 x 33 planetary pack. A port of scripts/catalog/terrain_features.py
// (descriptor version 2.0.0) for the one case where it is exact: a pack whose spacing equals the
// comparison resolution, so the area-average resample is a 2 x 2 block mean.
// No dependencies: runs in Deno (edge function) and in Node (vitest).

export const DESCRIPTOR_VERSION = '2.0.0';
export type FeatureVector = Record<string, number | null>;
export interface Grid { rows: number; columns: number; data: ArrayLike<number> }

/** The central window of floor(4000 / cell) cells of a 33 x 33 pack, as the pipeline's sample() cuts it. */
export function centralWindow(pack: Grid, cell: number): Grid {
  if (pack.rows !== 33 || pack.columns !== 33 || pack.data.length !== 1089) throw new Error('Expected a 33 x 33 grid.');
  const n = Math.floor(4000 / cell), start = (33 - n) / 2;
  // The window must start on a half cell: then every output cell is the mean of a 2 x 2 block.
  if (n < 3 || start < 0 || start % 1 !== 0.5) throw new Error('Window does not start on a half cell at this spacing.');
  const first = Math.floor(start), data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a = (first + i) * 33 + first + j;
    data[i * n + j] = (pack.data[a] + pack.data[a + 1] + pack.data[a + 33] + pack.data[a + 34]) / 4;
  }
  return { rows: n, columns: n, data };
}

function oddCells(width: number, cell: number, least = 0) {
  let n = Math.max(least, Math.ceil(width / cell));
  if (n % 2 === 0) n += 1;
  return n;
}

/** Box mean of `values` over n x n, for the interior cells only (where the box is fully inside). */
function interiorBoxMean(values: Float64Array, rows: number, columns: number, n: number): Float64Array {
  const half = (n - 1) / 2, h = rows - 2 * half, w = columns - 2 * half, out = new Float64Array(h * w);
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
    let sum = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) sum += values[(i + a) * columns + j + b];
    out[i * w + j] = sum / (n * n);
  }
  return out;
}

/** Local RMS about the local mean, for the interior cells. */
function localRms(values: Float64Array, rows: number, columns: number, n: number): Float64Array {
  const squares = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) squares[i] = values[i] * values[i];
  const mean = interiorBoxMean(values, rows, columns, n), mean2 = interiorBoxMean(squares, rows, columns, n);
  const out = new Float64Array(mean.length);
  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(Math.max(0, mean2[i] - mean[i] * mean[i]));
  return out;
}

const average = (values: ArrayLike<number>) => { let s = 0; for (let i = 0; i < values.length; i++) s += values[i]; return s / values.length; };

/** numpy.percentile with linear interpolation. */
export function percentile(values: ArrayLike<number>, q: number): number {
  const sorted = Float64Array.from(values).sort(), at = (q / 100) * (sorted.length - 1);
  const low = Math.floor(at), high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
}

/** Descriptors of a finite north-first metre grid; neighbourhood outputs use interior cells only. */
export function describe(grid: Grid, cell: number): FeatureVector {
  const { rows, columns } = grid, size = rows * columns, z = Float64Array.from(grid.data);
  if (z.length !== size || Math.min(rows, columns) < 3 || !(cell > 0) || z.some(v => !Number.isFinite(v)))
    throw new Error('Requires a finite 2D grid, at least 3 cells per side, positive metre spacing');
  const at = (i: number, j: number) => z[i * columns + j];
  // np.gradient: central differences inside, one-sided at the edges.
  const slope = new Float64Array(size);
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    const dy = i === 0 ? (at(1, j) - at(0, j)) / cell : i === rows - 1 ? (at(i, j) - at(i - 1, j)) / cell : (at(i + 1, j) - at(i - 1, j)) / (2 * cell);
    const dx = j === 0 ? (at(i, 1) - at(i, 0)) / cell : j === columns - 1 ? (at(i, j) - at(i, j - 1)) / cell : (at(i, j + 1) - at(i, j - 1)) / (2 * cell);
    slope[i * columns + j] = Math.atan(Math.hypot(dx, dy)) * 180 / Math.PI;
  }
  let min = Infinity, max = -Infinity;
  for (const v of z) { if (v < min) min = v; if (v > max) max = v; }
  const relief = max - min, mean = average(z);
  const share = (values: ArrayLike<number>, test: (v: number) => boolean) => { let n = 0; for (let i = 0; i < values.length; i++) if (test(values[i])) n++; return n / values.length; };
  const values: FeatureVector = {
    slope_mean: average(slope), slope_p90: percentile(slope, 90), relief,
    hypsometric_integral: relief > 1e-9 ? (mean - min) / relief : 0.5,
  };
  for (const limit of [5, 10, 15, 20]) values[`slope_gt_${limit}`] = share(slope, v => v > limit);
  const centred = z.map(v => v - mean), least = Math.min(rows, columns);
  for (const width of [150, 450, 1000]) {
    const n = oddCells(width, cell);
    values[`roughness_${width}m`] = n < 3 || n > least ? null : average(localRms(centred, rows, columns, n));
  }
  // Dimensionless topographic position relative to the local RMS, 1000 m minimum support.
  const n = oddCells(1000, cell, 3);
  if (n > least) { values.bowl_share = null; values.ridge_share = null; }
  else {
    const half = (n - 1) / 2, w = columns - 2 * half, local = interiorBoxMean(centred, rows, columns, n), rms = localRms(centred, rows, columns, n);
    const tpi = new Float64Array(local.length);
    for (let k = 0; k < tpi.length; k++) {
      const i = Math.floor(k / w) + half, j = k % w + half;
      tpi[k] = rms[k] > 1e-9 ? (centred[i * columns + j] - local[k]) / rms[k] : 0;
    }
    values.bowl_share = share(tpi, v => v < -0.5); values.ridge_share = share(tpi, v => v > 0.5);
  }
  // Remove one best-fit plane (least squares) before the scale-specific residual roughness.
  // On a full grid the centred column and row indices are orthogonal, so the fit is closed-form.
  const xm = (columns - 1) / 2, ym = (rows - 1) / 2;
  let sxz = 0, syz = 0, sxx = 0, syy = 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
    const c = centred[i * columns + j];
    sxz += (j - xm) * c; syz += (i - ym) * c; sxx += (j - xm) ** 2; syy += (i - ym) ** 2;
  }
  const bx = sxz / sxx, by = syz / syy, residual = new Float64Array(size);
  for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) residual[i * columns + j] = centred[i * columns + j] - bx * (j - xm) - by * (i - ym);
  for (const [key, box] of [['roughness_fine', 3], ['roughness_mid', 5], ['roughness_coarse', 7]] as const)
    values[key] = box > least ? null : average(localRms(residual, rows, columns, box));
  return values;
}

/** The comparison features of a 33 x 33 planetary pack at its own spacing. */
export function packFeatures(pack: Grid, spacingM: number): FeatureVector {
  return describe(centralWindow(pack, spacingM), spacingM);
}
