import { analogFidelity, stressFidelity, type FidelityResult, type StressFidelityResult } from '../../../app/sim/src/fidelity';
import type { SiteTerrain } from '../../../app/sim/src/types';
import { catalogSiteToSite } from '../../../app/sim/src/catalog';
import { catalogSites, siteCatalog } from '../data/sites';
import { extractProfile } from './mission';
import { analogSite, flightSetup } from './simulation';
import type { MissionConfig, TerrainManifest, TerrainProfile } from './types';

export interface FidelityReport { guided: FidelityResult; stress: StressFidelityResult }

function sites(mission: MissionConfig, analogProfile: TerrainProfile, planetaryProfile: TerrainProfile): { planetary: SiteTerrain; analog: SiteTerrain } {
  const entry = catalogSites.find(s => s.id === mission.planetaryTarget.id);
  if (!entry) throw new Error('the planetary target is not in the site catalog.');
  const planetary = catalogSiteToSite(entry, planetaryProfile.manifest, planetaryProfile.buffer, {}, siteCatalog);
  const analog = analogSite(mission, analogProfile);
  // Same scenario wind on both terrains, so the comparison is like for like.
  planetary.wind = analog.wind;
  return { planetary, analog };
}
// Manual flights cannot be replayed on another terrain, so both sides fly autonomously, under
// the planetary scenario's gravity and air even if the flown mission was an Earth field test.
const scenario = (mission: MissionConfig) => ({ ...flightSetup(mission), strategy: 'autonomous' as const,
  gravity: mission.planetaryTarget.gravity, atmosphere: mission.planetaryTarget.body === 'Moon' ? 0 : 0.02 });

/** Guided comparison: one hazard-avoiding landing at the centre of each terrain. Pure; used by tests. */
export function fidelityFor(mission: MissionConfig, analogProfile: TerrainProfile, planetaryProfile: TerrainProfile): FidelityResult {
  const { planetary, analog } = sites(mission, analogProfile, planetaryProfile);
  return analogFidelity(planetary, analog, { base: scenario(mission), seeds: [1, 2, 3], catalogTerrainScore: mission.evidence.quantitativeSimilarityScore });
}

/** Stress comparison: blind landings spread over each terrain. Uses terrain data only. */
export function stressFor(mission: MissionConfig, analogProfile: TerrainProfile, planetaryProfile: TerrainProfile): StressFidelityResult {
  const { planetary, analog } = sites(mission, analogProfile, planetaryProfile);
  const { start: _start, target: _target, ...base } = scenario(mission);
  return stressFidelity(planetary, analog, { base, catalogTerrainScore: mission.evidence.quantitativeSimilarityScore });
}

/** Loads the planetary target's own terrain pack, then runs the comparison flights. */
export async function computeFidelity(mission: MissionConfig, analogProfile: TerrainProfile, signal?: AbortSignal): Promise<FidelityReport> {
  const entry = catalogSites.find(s => s.id === mission.planetaryTarget.id);
  if (!entry) throw new Error('the planetary target is not in the site catalog.');
  if (!entry.terrain) throw new Error(`${entry.name} has no terrain pack to compare against.`);
  const manifestUrl = entry.terrain.manifest_url;
  const response = await fetch(manifestUrl, { signal });
  if (!response.ok) throw new Error(`planetary terrain unavailable (${response.status}).`);
  const manifest: TerrainManifest = await response.json();
  if (manifest.id !== entry.id || !/^[\w.-]+$/.test(manifest.grid.sample_file)) throw new Error('planetary terrain pack does not match the catalog.');
  const samples = await fetch(manifestUrl.slice(0, manifestUrl.lastIndexOf('/') + 1) + manifest.grid.sample_file, { signal });
  if (!samples.ok) throw new Error(`planetary elevation samples unavailable (${samples.status}).`);
  const planetaryProfile = extractProfile(manifest, await samples.arrayBuffer());
  // Let the report paint before the comparison flights run.
  await new Promise(resolve => setTimeout(resolve, 30));
  const guided = fidelityFor(mission, analogProfile, planetaryProfile);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { guided, stress: stressFor(mission, analogProfile, planetaryProfile) };
}
