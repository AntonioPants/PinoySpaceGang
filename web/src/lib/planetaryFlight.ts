import { createSim } from '../../../app/sim/src/index';
import type { SimInput } from '../../../app/sim/src/types';
import type { TerrainPack } from '../components/cutscene/terrainPack';
import { sampleTerrain } from './terrainComparison';

/** Create a separate flight over measured planetary terrain, in the overlay's aligned frame.
 * The caller owns stepping it and must never use its result as the flown mission outcome. */
export function createPlanetaryFlight(input: SimInput, planet: TerrainPack, earth: TerrainPack, body: 'moon' | 'mars') {
  const { rows, columns: cols, spacing_m: cellSize } = planet.manifest.grid;
  const target = input.target ?? { x: 0, y: 0 };
  const start = input.start?.position;
  const points = [target, ...(start ? [start] : [])];
  if (points.some(p => sampleTerrain(planet, p.x, p.y) === null || sampleTerrain(earth, p.x, p.y) === null)) {
    throw new Error('Planetary comparison does not cover the starting point and landing target.');
  }
  const p0 = sampleTerrain(planet, 0, 0), e0 = sampleTerrain(earth, 0, 0);
  if (p0 === null || e0 === null || planet.heights.length !== rows * cols) throw new Error('Invalid comparison terrain.');
  const heights = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const value = planet.heights[(rows - 1 - r) * cols + c];
    if (!Number.isFinite(value)) throw new Error('Planetary terrain contains missing elevations.');
    heights[r * cols + c] = value - p0 + e0;
  }
  return createSim({ ...input, site: { id: planet.manifest.id, name: planet.manifest.name, body,
    heightmap: { rows, cols, cellSize, heights }, wind: { x: 0, y: 0 } },
    gravity: body === 'moon' ? 1.62 : 3.72, atmosphere: body === 'moon' ? 0 : 0.02,
    interference: undefined });
}
