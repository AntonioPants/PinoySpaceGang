/**
 * Real Earth weather for an "Earth field test": Yousef's 2015–2024 NASA POWER profiles
 * (data/environment), applied through his adapter (app/lib/environment-site.ts).
 *
 * The site catalog and the weather profiles were built separately and name the same places
 * differently, so the pairing is written out here once.
 */
import { createEarthLandingInput } from '../../../app/lib/environment-site';
import { validateProfile } from '../../../app/lib/environment.mjs';
import type { EnvironmentProfile, Scenario, SiteId } from '../../../app/lib/environment.mjs';
import type { SimInput } from '../../../app/sim/src/types';

/** Catalog site ID → weather profile ID (same place; coordinates agree to within a few km). */
export const WEATHER_PROFILE_ID: Readonly<Record<string, SiteId>> = {
  'kilbourne-hole-v1': 'kilbourne_hole',
  'meteor-crater': 'meteor_crater',
  amboy: 'amboy_crater',
  badwater: 'badwater_basin',
  'white-sands': 'white_sands',
  'barrow-observatory': 'utqiagvik_beo',
};
export const hasWeatherProfile = (catalogId: string) => catalogId in WEATHER_PROFILE_ID;

// Vite serves the committed profiles straight from data/environment (no export step).
const files = import.meta.glob('../../../data/environment/*.json', { query: '?url', import: 'default' }) as Record<string, () => Promise<string>>;

export async function loadWeatherProfile(catalogId: string, signal?: AbortSignal): Promise<EnvironmentProfile> {
  const id = WEATHER_PROFILE_ID[catalogId];
  const file = id && files[`../../../data/environment/${id}.json`];
  if (!file) throw new Error('No weather profile exists for this site.');
  const response = await fetch(await file(), { signal });
  if (!response.ok) throw new Error(`Weather profile unavailable (${response.status}).`);
  return validateProfile(await response.json());
}

/**
 * Clockwise bearing of UTM grid north from true north (meridian convergence), degrees.
 * The Earth terrain packs are on UTM grids; geographic wind must be rotated onto them.
 */
export function utmGridNorthBearingDeg(latitude: number, longitude: number): number {
  const zone = Math.floor((longitude + 180) / 6) + 1;
  const centralMeridian = zone * 6 - 183;
  const rad = Math.PI / 180;
  return Math.atan(Math.tan((longitude - centralMeridian) * rad) * Math.sin(latitude * rad)) / rad;
}

export interface RealWeather { month: number; scenario: Scenario }

/**
 * Replaces an Earth field test's manual wind and standard air with one real modelled hour.
 * Only wind and air density change; gravity, vehicle and sensors stay as configured.
 */
export function withRealWeather(input: SimInput, profile: EnvironmentProfile, weather: RealWeather, location: { latitude: number; longitude: number }): SimInput {
  if (WEATHER_PROFILE_ID[input.site.id] !== profile.site.id) throw new Error('The weather profile does not match the selected Earth terrain.');
  // The adapter matches sites by the weather profile's ID.
  const { input: earth, environment } = createEarthLandingInput({ ...input.site, id: profile.site.id }, profile,
    { month: weather.month, scenario: weather.scenario },
    { gridNorthBearingDeg: utmGridNorthBearingDeg(location.latitude, location.longitude) });
  const hour = environment.weather;
  return {
    ...input,
    atmosphere: hour.air_density_kg_m3,
    site: { ...input.site, wind: earth.site.wind, airDensity: hour.air_density_kg_m3, sources: { ...input.site.sources,
      wind: `NASA POWER (MERRA-2) modelled hour ${hour.timestamp_utc}: ${weather.scenario === 'high_wind' ? 'high-wind' : 'typical'} hour for month ${weather.month}, ${hour.wind_speed_m_s.toFixed(1)} m/s from ${hour.wind_from_deg.toFixed(0)}°`,
      airDensity: `same hour: ${hour.air_density_kg_m3.toFixed(3)} kg/m³ at ${(hour.air_temperature_k - 273.15).toFixed(1)} °C, ${(hour.pressure_pa / 100).toFixed(0)} hPa`,
    } },
  };
}
