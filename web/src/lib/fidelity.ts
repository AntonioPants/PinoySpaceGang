import { analogFidelity, type FidelityResult } from '../../../app/sim/src/fidelity';
import { catalogSiteToSite, type CatalogSite } from '../../../app/sim/src/catalog';
import { loadProfile } from './mission';
import { analogSite, flightSetup } from './simulation';
import type { MissionConfig, TerrainProfile } from './types';

/** Builds the two sites and shared flight setup for a fidelity comparison. Pure; used by tests. */
export function fidelityFor(mission: MissionConfig, analogProfile: TerrainProfile, planetaryProfile: TerrainProfile,
  planetaryEntry: CatalogSite, analogEntry?: CatalogSite): FidelityResult {
  const planetary = catalogSiteToSite(planetaryEntry, planetaryProfile.manifest, planetaryProfile.buffer);
  const analog = analogSite(mission, analogProfile, analogEntry);
  // Same scenario wind on both terrains, so the comparison is like for like.
  planetary.wind = analog.wind;
  return analogFidelity(planetary, analog, {
    // Manual flights cannot be replayed on another terrain, so both sides fly autonomously.
    // The planetary scenario's own gravity and air, even if the flown mission was an Earth field test.
    base: { ...flightSetup(mission), strategy: 'autonomous', gravity: mission.planetaryTarget.gravity,
      atmosphere: mission.planetaryTarget.body === 'Moon' ? 0 : 0.02 },
    seeds: [1, 2, 3],
    catalogTerrainScore: mission.evidence.quantitativeSimilarityScore,
  });
}

/** Loads the planetary target's own terrain pack and scores the analog against it. */
export async function computeFidelity(mission: MissionConfig, analogProfile: TerrainProfile, analogEntry: CatalogSite | undefined,
  planetaryEntry: CatalogSite | undefined, signal?: AbortSignal): Promise<FidelityResult> {
  if (!planetaryEntry) throw new Error('the planetary target is not in the site catalog.');
  if (!planetaryEntry.terrain) throw new Error(`${planetaryEntry.name} has no terrain pack to compare against.`);
  const planetaryProfile = await loadProfile(signal, planetaryEntry.terrain.manifest_url.replace(/[^/]*$/, ''));
  // Let the report paint before the comparison flights run.
  await new Promise(resolve => setTimeout(resolve, 30));
  return fidelityFor(mission, analogProfile, planetaryProfile, planetaryEntry, analogEntry);
}
