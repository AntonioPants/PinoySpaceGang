import type { GameIntegrations } from './contracts';
import { lazy } from 'react';
import SystemsConsole from './SystemsConsole';

// Furgan's cutscenes, loaded only when a scene plays (they pull in the 3D engine).
const EarthApproachScene = lazy(() => import('./scenes/EarthApproachScene'));
const OutcomeScene = lazy(() => import('./scenes/OutcomeScene'));

// Team integration point. See docs/GAME_VISION.md before registering a scene.
// Tim: replace controlCenter with the 3D ship interior; planetaryArrival is optional.
// Furgan's opening and ending cutscenes are registered as earthApproach and outcome
// (adapters in ./scenes). liftoff is still open.
// A null cinematic is skipped; it does not block a playable mission.
export const gameIntegrations: GameIntegrations = {
  planetaryArrival: null,
  controlCenter: SystemsConsole,
  liftoff: null,
  earthApproach: EarthApproachScene,
  outcome: OutcomeScene,
};
