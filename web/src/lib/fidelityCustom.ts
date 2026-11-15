/**
 * Comparison flights for a pinned point (click anywhere): the planetary terrain is the grid the
 * matching service read, not a catalog site.
 *
 * This lives beside lib/fidelity.ts instead of inside it on purpose: fidelity.ts is part of the
 * landing baseline's engine fingerprint (app/sim/scripts/engine-fingerprint.ts), so editing it
 * would invalidate the published baseline. The scenario below is the same one fidelity.ts flies:
 * autonomous, under the planetary target's gravity and air, same wind on both terrains. The
 * cached baseline never applies to a pin.
 */
import { analogFidelity, stressFidelity } from '../../../app/sim/src/fidelity';
import type { CatalogSite } from '../../../app/sim/src/catalog';
import { terrainPackToSite } from '../../../app/sim/src/loaders';
import type { SiteTerrain } from '../../../app/sim/src/types';
import type { FidelityReport } from './fidelity';
import { analogSite, flightSetup } from './simulation';
import type { MissionConfig, TerrainProfile } from './types';

export async function computeCustomFidelity(mission: MissionConfig, analogProfile: TerrainProfile, planetaryProfile: TerrainProfile,
  analogEntry?: CatalogSite, signal?: AbortSignal): Promise<FidelityReport> {
  const body = mission.planetaryTarget.body === 'Moon' ? 'moon' : 'mars';
  if (planetaryProfile.manifest.body.toLowerCase() !== body || planetaryProfile.manifest.id !== mission.planetaryTarget.id)
    throw new Error('the planetary terrain does not belong to this mission.');
  const planetary: SiteTerrain = { ...terrainPackToSite(planetaryProfile.manifest, planetaryProfile.buffer), id: mission.planetaryTarget.id, name: mission.planetaryTarget.name, body };
  const analog = analogSite(mission, analogProfile, analogEntry);
  planetary.wind = analog.wind;
  const base = { ...flightSetup(mission), strategy: 'autonomous' as const,
    gravity: mission.planetaryTarget.gravity, atmosphere: mission.planetaryTarget.body === 'Moon' ? 0 : 0.02 };
  const catalogTerrainScore = mission.evidence.quantitativeSimilarityScore;
  // Let the report paint before the comparison flights run.
  await new Promise(resolve => setTimeout(resolve, 30));
  const guided = analogFidelity(planetary, analog, { base, seeds: [1, 2, 3], catalogTerrainScore });
  await new Promise(resolve => setTimeout(resolve, 0));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const { start: _start, target: _target, ...blind } = base;
  return { guided, stress: stressFidelity(planetary, analog, { base: blind, catalogTerrainScore }) };
}
