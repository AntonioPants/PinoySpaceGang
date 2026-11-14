/** Explicit join between production terrain IDs and the separate seasonal profile IDs. */
import kilbourne from '../../../data/environment/kilbourne_hole.json';
import meteor from '../../../data/environment/meteor_crater.json';
import amboy from '../../../data/environment/amboy_crater.json';
import badwater from '../../../data/environment/badwater_basin.json';
import whiteSands from '../../../data/environment/white_sands.json';
import barrow from '../../../data/environment/utqiagvik_beo.json';

const profiles: Record<string, Record<string, unknown>> = {
  'kilbourne-hole-v1': kilbourne,
  'meteor-crater': meteor,
  amboy,
  badwater,
  'white-sands': whiteSands,
  'barrow-observatory': barrow,
};

export interface CatalogEnvironment {
  status: 'available' | 'unavailable';
  profile: Record<string, unknown> | null;
  reason: string | null;
}

export function catalogEnvironment(id: string): CatalogEnvironment {
  const profile = profiles[id];
  return profile ? { status: 'available', profile, reason: null }
    : { status: 'unavailable', profile: null, reason: 'No separate seasonal environment profile has been ingested for this site.' };
}
