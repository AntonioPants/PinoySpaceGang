import { analogFidelity, stressFidelity, type FidelityResult, type StressFidelityResult } from '../../../app/sim/src/fidelity';
import type { SiteTerrain } from '../../../app/sim/src/types';
import { catalogSiteToSite, type CatalogSite } from '../../../app/sim/src/catalog';
import { catalogSites, siteCatalog } from '../data/sites';
import { loadProfile } from './mission';
import { analogSite, flightSetup } from './simulation';
import type { MissionConfig, TerrainProfile } from './types';
import { isBaselineMission, loadLandingSimilarity } from './landingSimilarity';

export interface FidelityReport { guided: FidelityResult; stress: StressFidelityResult }

function sites(mission: MissionConfig, analogProfile: TerrainProfile, planetaryProfile: TerrainProfile,
  entry = catalogSites.find(s => s.id === mission.planetaryTarget.id), analogEntry?: CatalogSite): { planetary: SiteTerrain; analog: SiteTerrain } {
  if (!entry) throw new Error('the planetary target is not in the site catalog.');
  const planetary = catalogSiteToSite(entry, planetaryProfile.manifest, planetaryProfile.buffer, {}, siteCatalog);
  const analog = analogSite(mission, analogProfile, analogEntry);
  // Same scenario wind on both terrains, so the comparison is like for like.
  planetary.wind = analog.wind;
  return { planetary, analog };
}
// Manual flights cannot be replayed on another terrain, so both sides fly autonomously, under
// the planetary scenario's gravity and air even if the flown mission was an Earth field test.
const scenario = (mission: MissionConfig) => ({ ...flightSetup(mission), strategy: 'autonomous' as const,
  gravity: mission.planetaryTarget.gravity, atmosphere: mission.planetaryTarget.body === 'Moon' ? 0 : 0.02 });

/** Guided comparison: one hazard-avoiding landing at the centre of each terrain. Pure; used by tests. */
export function fidelityFor(mission: MissionConfig, analogProfile: TerrainProfile, planetaryProfile: TerrainProfile,
  planetaryEntry?: CatalogSite, analogEntry?: CatalogSite): FidelityResult {
  const { planetary, analog } = sites(mission, analogProfile, planetaryProfile, planetaryEntry, analogEntry);
  return analogFidelity(planetary, analog, { base: scenario(mission), seeds: [1, 2, 3], catalogTerrainScore: mission.evidence.quantitativeSimilarityScore });
}

/** Stress comparison: blind landings spread over each terrain. Uses terrain data only. */
export function stressFor(mission: MissionConfig, analogProfile: TerrainProfile, planetaryProfile: TerrainProfile,
  planetaryEntry?: CatalogSite, analogEntry?: CatalogSite): StressFidelityResult {
  const { planetary, analog } = sites(mission, analogProfile, planetaryProfile, planetaryEntry, analogEntry);
  const { start: _start, target: _target, ...base } = scenario(mission);
  return stressFidelity(planetary, analog, { base, catalogTerrainScore: mission.evidence.quantitativeSimilarityScore });
}

/** Loads the planetary target's own terrain pack, then runs the comparison flights. */
export async function computeFidelity(mission: MissionConfig, analogProfile: TerrainProfile,
  analogEntry?: CatalogSite, entry = catalogSites.find(s => s.id === mission.planetaryTarget.id), signal?: AbortSignal): Promise<FidelityReport> {
  if (!entry) throw new Error('the planetary target is not in the site catalog.');
  if (!entry.terrain) throw new Error(`${entry.name} has no terrain pack to compare against.`);
  const planetaryProfile = await loadProfile(signal, entry.terrain.manifest_url, entry.id, entry.body);
  // Let the report paint before the comparison flights run.
  await new Promise(resolve => setTimeout(resolve, 30));
  const guided = fidelityFor(mission, analogProfile, planetaryProfile, entry, analogEntry);
  await new Promise(resolve => setTimeout(resolve, 0));
  let cached:StressFidelityResult|undefined;
  if(isBaselineMission(mission)) {
    try {
      const data=await loadLandingSimilarity();
      cached=data.rows.find(r=>r.earth_id===mission.earthAnalog.id&&r.planetary_id===mission.planetaryTarget.id)?.stress;
    } catch { /* Missing baseline is optional: preserve the live calculation. */ }
  }
  return { guided, stress: cached ?? stressFor(mission, analogProfile, planetaryProfile, entry, analogEntry) };
}
