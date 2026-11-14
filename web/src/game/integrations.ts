import type { GameIntegrations } from './contracts';
import { lazy } from 'react';
import SystemsConsole from './SystemsConsole';

// Furgan's opening cutscene, loaded only when it plays (it pulls in the 3D engine).
const EarthApproachScene = lazy(() => import('./scenes/EarthApproachScene'));

// Team integration point. See docs/GAME_VISION.md before registering a scene.
// Tim: replace controlCenter with the 3D ship interior; planetaryArrival is optional.
// Furgan's opening cutscene is registered as earthApproach (adapter in ./scenes), and his
// live 3D view flies the descent and its ending (components/Descent3D). liftoff is still open.
// A null cinematic is skipped; it does not block a playable mission.
export const gameIntegrations: GameIntegrations = {
  planetaryArrival: null,
  controlCenter: SystemsConsole,
  liftoff: null,
  earthApproach: EarthApproachScene,
  // The 3D descent plays the ending for the real outcome itself, so no separate outcome scene.
  outcome: null,
};
