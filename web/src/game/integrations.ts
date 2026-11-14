import type { GameIntegrations } from './contracts';
import SystemsConsole from './SystemsConsole';

// Team integration point. See docs/GAME_VISION.md before registering a scene.
// Tim: replace controlCenter with the 3D ship interior; planetaryArrival is optional.
// Furgan: import/register liftoff, earthApproach and outcome as they become available.
// A null cinematic is skipped; it does not block a playable mission.
export const gameIntegrations: GameIntegrations = {
  planetaryArrival: null,
  controlCenter: SystemsConsole,
  liftoff: null,
  earthApproach: null,
  outcome: null,
};
