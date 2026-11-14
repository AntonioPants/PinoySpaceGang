import type { Body, SiteTerrain } from './types.ts';

const BODY_SET = new Set<Body>(['moon', 'mars', 'earth']);

/**
 * Validates one site entry from the shared sites.json (see fixtures/sites.example.json for the
 * proposed shape) and returns it as SiteTerrain. Throws with a readable message on bad data so
 * data problems show up at load time, not as a weird crash mid-flight.
 */
export function parseSite(raw: unknown): SiteTerrain {
  const s = raw as Record<string, any>;
  const where = `site ${s?.id ?? '(no id)'}`;
  if (!s || typeof s !== 'object') throw new Error('site entry must be an object');
  if (typeof s.id !== 'string') throw new Error(`${where}: "id" must be a string`);
  if (!BODY_SET.has(s.body)) throw new Error(`${where}: "body" must be moon | mars | earth`);
  if (s.analogOf !== undefined && !['moon', 'mars'].includes(s.analogOf))
    throw new Error(`${where}: "analogOf" must be moon | mars`);
  const hm = s.heightmap;
  if (!hm || typeof hm !== 'object') throw new Error(`${where}: missing "heightmap"`);
  for (const k of ['cols', 'rows', 'cellSize'] as const) {
    if (!(typeof hm[k] === 'number' && hm[k] > 0)) throw new Error(`${where}: heightmap.${k} must be a positive number`);
  }
  if (!Array.isArray(hm.heights) || hm.heights.length !== hm.cols * hm.rows)
    throw new Error(`${where}: heightmap.heights must have cols*rows = ${hm.cols * hm.rows} numbers`);
  if (hm.heights.some((v: unknown) => typeof v !== 'number' || !Number.isFinite(v)))
    throw new Error(`${where}: heightmap.heights contains a non-number`);
  return {
    id: s.id,
    name: s.name,
    body: s.body,
    analogOf: s.analogOf,
    heightmap: {
      cols: hm.cols,
      rows: hm.rows,
      cellSize: hm.cellSize,
      heights: hm.heights,
      originX: hm.originX,
      originY: hm.originY,
    },
    wind: s.wind,
    albedo: s.albedo,
    soilType: s.soilType,
    gravity: s.gravity,
    airDensity: s.airDensity,
  };
}

/** Parses the whole sites.json: either an array of sites or { sites: [...] }. */
export function parseSites(raw: unknown): SiteTerrain[] {
  const list = Array.isArray(raw) ? raw : (raw as { sites?: unknown[] })?.sites;
  if (!Array.isArray(list)) throw new Error('sites.json must be an array or { "sites": [...] }');
  return list.map(parseSite);
}
