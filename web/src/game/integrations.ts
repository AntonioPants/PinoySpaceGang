import type { GameIntegrations } from './contracts';
import { lazy } from 'react';

// Furgan's opening cutscene, loaded only when it plays (it pulls in the 3D engine).
const EarthApproachScene = lazy(() => import('./scenes/EarthApproachScene'));
// Furgan's departure cutscene: liftoff from Earth.
const LiftoffScene = lazy(() => import('./scenes/LiftoffScene'));
// Tim's third-person ship bridge. It falls back to the flat SystemsConsole by itself.
const ShipInterior = lazy(() => import('./interior/ShipInterior'));

// Team integration point. See docs/GAME_VISION.md before registering a scene.
// controlCenter is the third-person ship bridge (./interior); planetaryArrival is still open.
// Furgan's opening cutscene is registered as earthApproach (adapter in ./scenes), and his
// live 3D view flies the descent and its ending (components/Descent3D). His departure cutscene is
// registered as liftoff: a blast-off from Earth (the test flight takes off and lands on Earth).
// Tim's space departure shot (./scenes/DepartureScene) is not used. Scene changes dissolve from one
// scene's last frame into the next.
// A null cinematic is skipped; it does not block a playable mission.
/** Fetches the code of every scene ahead of time, so moving on never waits on a download. */
export function preloadScenes() {
  for (const load of [() => import('./interior/ShipInterior'), () => import('./scenes/LiftoffScene'), () => import('./scenes/EarthApproachScene'),
    () => import('../components/Descent').then(m => m.preloadDescent3D())]) void load().catch(() => { /* loads on demand instead */ });
}

export const gameIntegrations: GameIntegrations = {
  planetaryArrival: null,
  controlCenter: ShipInterior,
  liftoff: LiftoffScene,
  earthApproach: EarthApproachScene,
  // The 3D descent plays the ending for the real outcome itself, so no separate outcome scene.
  outcome: null,
};
