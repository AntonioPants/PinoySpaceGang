/** Data-team adapter to the existing simulator contract; does not change its physics. */
import type { SiteTerrain, SimInput, Strategy } from '../sim/src/types.ts';
import { createSimulationInputs } from './environment.mjs';
import type { EnvironmentProfile, Selection, SimulationInputs } from './environment.mjs';

export interface EarthLandingOptions {
  /** Clockwise bearing of terrain grid north from true north, in degrees.
   * Use 0 for true ENU; supply meridian convergence for UTM. */
  gridNorthBearingDeg: number;
  strategy?: Strategy;
  /** Explicit opt-in: the supplied albedo is regional, not a pad measurement. */
  useRegionalAlbedo?: boolean;
}

export function createEarthLandingInput(
  terrain: SiteTerrain,
  profile: EnvironmentProfile,
  selection: Selection,
  options: EarthLandingOptions,
): { input: SimInput; environment: SimulationInputs } {
  const matchingId = terrain.id === 'kilbourne-hole-v1' ? 'kilbourne_hole' : terrain.id;
  if (terrain.body !== 'earth') throw new Error('Earth weather requires Earth terrain');
  if (matchingId !== profile.site.id) throw new Error('Terrain and environmental site IDs do not match');
  if (!Number.isFinite(options.gridNorthBearingDeg) || Math.abs(options.gridNorthBearingDeg) > 180) {
    throw new Error('Supply terrain grid north bearing in [-180, 180] degrees');
  }
  const environment = createSimulationInputs(profile, selection);
  const { wind_east_m_s: east, wind_north_m_s: north, air_density_kg_m3: airDensity } = environment.weather;
  const angle = options.gridNorthBearingDeg * Math.PI / 180;
  // Project geographic wind onto terrain east/north; simulator Z is UP.
  const wind = {
    x: east * Math.cos(angle) - north * Math.sin(angle),
    y: east * Math.sin(angle) + north * Math.cos(angle),
  };
  const site: SiteTerrain = {
    ...terrain,
    wind,
    airDensity,
    soilType: profile.site.surface_materials.values.join('; '),
  };
  if (options.useRegionalAlbedo) {
    const albedo = environment.radiationContext.albedo.mean;
    if (albedo === null) throw new Error('Regional albedo is unavailable for this period');
    site.albedo = albedo;
  }
  return {
    input: { site, strategy: options.strategy ?? 'autonomous', gravity: 'native', atmosphere: 'native' },
    environment,
  };
}
