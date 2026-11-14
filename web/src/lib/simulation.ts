import { terrainPackToSite } from '../../../app/sim/src/loaders';
import { catalogSiteToSite } from '../../../app/sim/src/catalog';
import { catalogSites, siteCatalog } from '../data/sites';
import type { SimInput, SiteTerrain } from '../../../app/sim/src/types';
import type { EnvironmentProfile } from '../../../app/lib/environment.mjs';
import { withRealWeather } from './weather';
import type { MissionConfig, TerrainProfile } from './types';

/** The Earth analog as the physics flies it: terrain plus its catalog surface data. */
export function analogSite(mission: MissionConfig, profile: TerrainProfile): SiteTerrain {
  const body = mission.planetaryTarget.body === 'Moon' ? 'moon' : 'mars';
  if (mission.earthAnalog.id !== profile.manifest.id) throw new Error('The loaded terrain does not match this mission. Return to configuration.');
  const entry = catalogSites.find(s => s.id === profile.manifest.id);
  const site = entry ? catalogSiteToSite(entry, profile.manifest, profile.buffer, { analogOf: body }, siteCatalog)
    : terrainPackToSite(profile.manifest, profile.buffer, { analogOf: body });
  if (mission.environment.mode === 'earth') site.analogOf = undefined;
  // Wind is the user's scenario setting (speed along +x); the catalog has no wind direction.
  site.wind = { x: mission.environment.windSpeedMs, y: 0 };
  return site;
}

/** Vehicle, sensors and interference shared by the flown descent and the fidelity comparison. */
export function flightSetup(mission: MissionConfig): Pick<SimInput, 'strategy' | 'lander' | 'sensors' | 'interference' | 'start' | 'target' | 'maxTimeS'> {
  return {
    strategy: mission.strategy.mode === 'MANUAL_CONTROL' ? 'manual' : 'autonomous',
    lander: { name:'Configured experimental lander', dryMassKg:mission.strategy.dryMassKg, fuelKg:mission.strategy.fuelMassKg,
      maxThrustN:mission.strategy.thrusterForceN, limits:{maxSlopeDeg:mission.strategy.maxSlopeToleranceDeg} },
    sensors:{hazard:mission.strategy.hazardSensor,velocimeter:true},
    // 'site': left unset so the engine derives dust and glare from the site's surface data.
    interference: mission.environment.interferenceSource === 'site' ? undefined : {dust:mission.environment.dust,glare:mission.environment.glare},
    start:{position:{x:-400,y:0,z:1000},velocity:{x:25,y:0,z:-20}}, target:{x:0,y:0}, maxTimeS:300,
  };
}

export function toSimInput(mission: MissionConfig, profile: TerrainProfile, weather?: EnvironmentProfile | null): SimInput {
  const body = mission.planetaryTarget.body === 'Moon' ? 'moon' : 'mars';
  const input: SimInput = {
    site: analogSite(mission, profile), ...flightSetup(mission),
    gravity: mission.environment.gravityMs2,
    atmosphere: mission.environment.mode === 'earth' ? 1.225 : body === 'moon' ? 0 : 0.02,
    seed:1,
  };
  const real = mission.environment.realWeather;
  if (!real) return input;
  const entry = catalogSites.find(s => s.id === profile.manifest.id);
  if (!weather || !entry) throw new Error('This mission uses real weather, but the weather profile is not loaded.');
  return withRealWeather(input, weather, real, entry);
}
