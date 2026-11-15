import type { ComponentType } from 'react';
import type { EnvironmentProfile } from '../../../app/lib/environment.mjs';
import type { FlightTelemetry } from '../../../app/sim/src/types';
import type { MissionConfig, MissionSettings } from '../lib/types';

/** Scenes never create another simulation or change the selected terrain. */
export interface SceneProps {
  /** Build and render silently under the previous screen; never play or complete while warming. */
  warming?: boolean;
  onPrepared?: (ready: boolean) => void;
  /** Fill the game viewport; planner/debug embeds keep their own sizing. */
  immersive?: boolean;
  mission: MissionConfig;
  reducedMotion: boolean;
  onComplete: () => void;
  onExit: () => void;
}
export interface ControlCenterProps extends Omit<SceneProps, 'onComplete'> {
  settings: MissionSettings;
  onSettingsChange: (settings: MissionSettings) => void;
  onLaunch: () => void;
  error: string;
  weatherAvailable: boolean;
  weather: EnvironmentProfile | null;
}
export interface OutcomeSceneProps extends SceneProps { flight: FlightTelemetry }
export interface GameIntegrations {
  planetaryArrival: ComponentType<SceneProps> | null;
  controlCenter: ComponentType<ControlCenterProps>;
  liftoff: ComponentType<SceneProps> | null;
  earthApproach: ComponentType<SceneProps> | null;
  outcome: ComponentType<OutcomeSceneProps> | null;
}
export type GamePhase = 'planetaryArrival' | 'controlCenter' | 'liftoff' | 'earthApproach' | 'descent' | 'outcome' | 'report';
const order: GamePhase[] = ['planetaryArrival', 'controlCenter', 'liftoff', 'earthApproach', 'descent', 'outcome', 'report'];
export function nextPhase(phase: GamePhase | null, integrations: GameIntegrations): GamePhase {
  return order.slice(phase === null ? 0 : order.indexOf(phase) + 1)
    .find(p => p === 'descent' || p === 'report' || integrations[p]) ?? 'report';
}
/** Ignore duplicate completion calls and callbacks from an unmounted scene. */
export function completePhase(current: GamePhase, completed: GamePhase, integrations: GameIntegrations): GamePhase {
  return current === completed ? nextPhase(current, integrations) : current;
}
