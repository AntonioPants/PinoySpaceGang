import type { GameIntegrations } from './contracts';
import SystemsConsole from './SystemsConsole';
import { lazy } from 'react';

// Team integration point. See docs/GAME_VISION.md before registering a scene.
// Tim: replace controlCenter with the 3D ship interior; planetaryArrival is optional.
// Furgan: import/register liftoff, earthApproach and outcome as they become available.
// A null cinematic is skipped; it does not block a playable mission.
export const gameIntegrations: GameIntegrations = {
  planetaryArrival: null,
  controlCenter: SystemsConsole,
  liftoff: null,
  earthApproach: lazy(() => import('./CinematicBridge').then(m => ({ default: m.EarthApproach }))),
  outcome: lazy(() => import('./CinematicBridge').then(m => ({ default: m.LandingOutcome }))),
};
