import type { CutsceneEnv, PresetName } from '../../components/cutscene';
import type { MissionConfig } from '../../lib/types';

/**
 * Colour preset for each Earth analog. The terrain packs carry elevation only, no imagery, so
 * this is an illustration of the site's general character, not data. Unknown sites use 'desert'.
 */
const PRESET: Record<string, PresetName> = {
  'kilbourne-hole-v1': 'desert',
  'meteor-crater': 'crater',
  amboy: 'volcanic',
  'craters-moon': 'volcanic',
  'lava-beds': 'volcanic',
  'barrow-observatory': 'ice',
  haughton: 'ice',
  badwater: 'desert',
  'white-sands': 'desert',
  'capitol-reef': 'desert',
  qaidam: 'desert',
};

/** What Furgan's cutscenes need to draw the Earth analog of a mission. */
export function sceneEnv(mission: MissionConfig): { env: CutsceneEnv; terrainUrl: string } {
  return {
    env: {
      name: mission.earthAnalog.name,
      subtitle: mission.environment.mode === 'earth' ? 'Earth field test' : `Earth analog for ${mission.planetaryTarget.name}`,
      preset: PRESET[mission.earthAnalog.id] ?? 'desert',
    },
    terrainUrl: mission.earthAnalog.terrainBaseUrl,
  };
}
