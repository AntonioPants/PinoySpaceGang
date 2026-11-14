import { terrainPackToSite } from '../../../app/sim/src/loaders';
import { catalogSiteToSite } from '../../../app/sim/src/catalog';
import { catalogSites } from '../data/sites';
import type { SimInput } from '../../../app/sim/src/types';
import type { MissionConfig, TerrainProfile } from './types';
export function toSimInput(mission: MissionConfig, profile: TerrainProfile): SimInput {
  const body = mission.planetaryTarget.body === 'Moon' ? 'moon' : 'mars';
  if (mission.earthAnalog.id !== profile.manifest.id) throw new Error('The loaded terrain does not match this mission. Return to configuration.');
  const entry = catalogSites.find(s => s.id === profile.manifest.id);
  const site = entry ? catalogSiteToSite(entry, profile.manifest, profile.buffer, { analogOf: body })
    : terrainPackToSite(profile.manifest, profile.buffer, { analogOf: body });
  if (mission.environment.mode === 'earth') site.analogOf = undefined;
  site.wind = { x: mission.environment.windSpeedMs, y: 0 };
  return {
    site, strategy: mission.strategy.mode === 'MANUAL_CONTROL' ? 'manual' : 'autonomous',
    gravity: mission.environment.gravityMs2,
    atmosphere: mission.environment.mode === 'earth' ? 1.225 : body === 'moon' ? 0 : 0.02,
    lander: { name:'Configured experimental lander', dryMassKg:mission.strategy.dryMassKg, fuelKg:mission.strategy.fuelMassKg,
      maxThrustN:mission.strategy.thrusterForceN, limits:{maxSlopeDeg:mission.strategy.maxSlopeToleranceDeg} },
    sensors:{hazard:'lidar',velocimeter:true}, interference:{dust:mission.environment.dust,glare:mission.environment.glare},
    start:{position:{x:-400,y:0,z:1000},velocity:{x:25,y:0,z:-20}}, target:{x:0,y:0}, seed:1, maxTimeS:300,
  };
}
