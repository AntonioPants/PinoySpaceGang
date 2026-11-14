import type { MissionConfig, MissionSettings, PlanetarySite, TerrainManifest, TerrainProfile } from './types';
export const TERRAIN_BASE = '/terrain/kilbourne-hole-v1/';
export const defaultSettings: MissionSettings = {
  mode: 'AUTONOMOUS_HAZARD_AVOID', environment: 'planetary',
  fuelMassKg: 350, dryMassKg: 800, thrusterForceN: 12000, maxSlopeToleranceDeg: 12, windSpeedMs: 0, dust: 0, glare: 0,
  hazardSensor: 'lidar', siteConditions: true, realWeatherMonth: 0, weatherScenario: 'typical',
};
export function extractProfile(manifest: TerrainManifest, buffer: ArrayBuffer): TerrainProfile {
  const { rows, columns, spacing_m, dtype, byte_order } = manifest.grid;
  if (manifest.schema_version !== 1 || !Number.isInteger(rows) || rows < 2 || !Number.isInteger(columns) || columns < 2 ||
      !Number.isFinite(spacing_m) || spacing_m <= 0 || dtype !== 'float32' || byte_order !== 'little-endian' ||
      !Number.isFinite(manifest.local_frame.vertical_offset_m)) throw new Error('Unsupported terrain metadata.');
  if (buffer.byteLength !== rows * columns * 4) throw new Error('Terrain download has an unexpected size.');
  const row = Math.floor(rows / 2), view = new DataView(buffer);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < rows * columns; i++) {
    const value = view.getFloat32(i * 4, true);
    if (!Number.isFinite(value)) throw new Error('Terrain contains missing elevation data.');
    min = Math.min(min, value); max = Math.max(max, value);
  }
  const heightsM = Array.from({ length: columns }, (_, col) => {
    const height = view.getFloat32((row * columns + col) * 4, true);
    if (!Number.isFinite(height)) throw new Error('Terrain transect contains missing elevation data.');
    return height - manifest.local_frame.vertical_offset_m;
  });
  // Catalog packs may omit display metrics; derive them from the actual grid.
  const normalized = { ...manifest,
    grid: { ...manifest.grid, width_m: (columns - 1) * spacing_m, depth_m: (rows - 1) * spacing_m },
    statistics: { ...manifest.statistics, relief_m: max - min },
  };
  return { manifest: normalized, heightsM, sampleSpacingM: spacing_m, row, buffer };
}
export async function loadProfile(signal?: AbortSignal, location = TERRAIN_BASE, expectedId?: string, expectedBody: 'earth' | 'moon' | 'mars' = 'earth'): Promise<TerrainProfile> {
  if (!/^\/terrain\/[\w.-]+\/(manifest\.json)?$/.test(location)) throw new Error('Invalid terrain location.');
  const base = location.replace(/manifest\.json$/, '');
  const response = await fetch(`${base}manifest.json`, { signal });
  if (!response.ok) throw new Error(`Terrain manifest unavailable (${response.status}).`);
  const raw = await response.json();
  if ((expectedId && raw.id !== expectedId) || raw.body?.toLowerCase() !== expectedBody) throw new Error('Terrain pack does not match the selected location and body.');
  const manifest: TerrainManifest = { ...raw, source: { ...raw.source,
    dataset: raw.source.dataset ?? (expectedBody === 'earth' ? 'Copernicus DEM GLO-30' : 'Planetary DEM'), catalog: raw.source.catalog ?? raw.source.url,
    sha256: raw.source.sha256 ?? raw.source.subset_sha256,
  } };
  if (!/^[\w.-]+$/.test(manifest.grid.sample_file)) throw new Error('Invalid terrain sample filename.');
  const samples = await fetch(`${base}${manifest.grid.sample_file}`, { signal });
  if (!samples.ok) throw new Error(`Elevation samples unavailable (${samples.status}).`);
  return { ...extractProfile(manifest, await samples.arrayBuffer()), terrainBaseUrl: base };
}
export const gravityFor = (site: PlanetarySite, settings: MissionSettings) => settings.environment === 'earth' ? 9.81 : site.gravity;
export function validateSettings(s: MissionSettings): string[] {
  const errors: string[] = [];
  for (const [key, min, max] of [['fuelMassKg', 50, 2000], ['dryMassKg', 100, 5000], ['thrusterForceN', 1000, 50000], ['maxSlopeToleranceDeg', 1, 30], ['windSpeedMs', 0, 30], ['dust', 0, 1], ['glare', 0, 1]] as const) {
    if (!Number.isFinite(s[key]) || s[key] < min || s[key] > max) errors.push(`${key} is outside its supported range.`);
  }
  if (!['MANUAL_CONTROL', 'AUTONOMOUS_HAZARD_AVOID'].includes(s.mode)) errors.push('Unknown control mode.');
  if (!['earth', 'planetary'].includes(s.environment)) errors.push('Unknown environment mode.');
  if (!['lidar', 'camera', 'none'].includes(s.hazardSensor)) errors.push('Unknown hazard sensor.');
  if (typeof s.siteConditions !== 'boolean') errors.push('siteConditions must be true or false.');
  if (!Number.isInteger(s.realWeatherMonth) || s.realWeatherMonth < 0 || s.realWeatherMonth > 12) errors.push('realWeatherMonth must be 0 (manual) or 1–12.');
  if (!['typical', 'high_wind'].includes(s.weatherScenario)) errors.push('Unknown weather scenario.');
  return errors;
}
export interface MissionContext { terrainBase?: string; analogName?: string; terrainScore?: number | null;
  /** True when a real weather profile exists for the analog site. */
  weatherAvailable?: boolean }
export function buildMission(site: PlanetarySite, profile: TerrainProfile, settings: MissionSettings, context: MissionContext = {}): MissionConfig {
  const errors = validateSettings(settings);
  if (errors.length) throw new Error(errors.join(' '));
  const lunarVacuum = settings.environment === 'planetary' && site.body === 'Moon';
  return {
    schemaVersion: '1.0.0', createdAt: new Date().toISOString(),
    planetaryTarget: { id: site.id, name: site.name, body: site.body, gravity: site.gravity },
    earthAnalog: { id: profile.manifest.id, name: context.analogName ?? profile.manifest.name, terrainBaseUrl: context.terrainBase ?? profile.terrainBaseUrl ?? `/terrain/${profile.manifest.id}/`,
      elevationProfile: profile.heightsM, sampleSpacingM: profile.sampleSpacingM, profileRow: profile.row,
      verticalOffsetM: profile.manifest.local_frame.vertical_offset_m, sourceSha256: profile.manifest.source.sha256 ?? profile.manifest.source.subset_sha256 ?? '' },
    strategy: { mode: settings.mode, hazardSensor: settings.hazardSensor, thrusterForceN: settings.thrusterForceN, fuelMassKg: settings.fuelMassKg, dryMassKg: settings.dryMassKg, maxSlopeToleranceDeg: settings.maxSlopeToleranceDeg },
    environment: { mode: settings.environment, gravityMs2: gravityFor(site, settings), windSpeedMs: lunarVacuum ? 0 : settings.windSpeedMs,
      atmosphereModel: lunarVacuum ? 'none' : settings.environment === 'earth' ? 'earth-standard' : 'mars-constant', dust: settings.dust, glare: settings.glare, interferenceSource: settings.siteConditions ? 'site' : 'manual',
      realWeather: settings.environment === 'earth' && settings.realWeatherMonth > 0 && context.weatherAvailable
        ? { month: settings.realWeatherMonth, scenario: settings.weatherScenario } : null },
    evidence: { quantitativeSimilarityScore: context.terrainScore ?? null, analogFidelityScore: null,
      status: typeof context.terrainScore === 'number' ? 'proposed-pair' : 'unvalidated-pair', limitations: profile.manifest.limitations },
  };
}
