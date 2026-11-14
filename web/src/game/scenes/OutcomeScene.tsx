import { Cutscene } from '../../components/cutscene';
import type { OutcomeSceneProps } from '../contracts';
import { SceneFrame } from './SceneFrame';
import { sceneEnv } from './sceneEnv';

const TITLE: Record<string, string> = {
  success: 'Touchdown', 'hard-landing': 'Hard landing', 'tip-over': 'Tip-over', crash: 'Crash', timeout: 'No touchdown',
};

/**
 * Furgan's ending cutscene: replays the last seconds of the flight that was actually flown and
 * ends according to the physics outcome. The telemetry decides what is shown, never the scene.
 */
export default function OutcomeScene({ mission, flight, reducedMotion, onComplete }: OutcomeSceneProps) {
  const { env, terrainUrl } = sceneEnv(mission);
  const summary = flight.summary;
  const title = TITLE[summary?.outcome ?? 'timeout'] ?? 'Flight ended';
  const detail = summary?.failureReasons.length ? summary.failureReasons.join('. ')
    : summary?.outcome === 'success' ? `Sink rate ${summary.verticalSpeedMps.toFixed(2)} m/s, lateral ${summary.horizontalSpeedMps.toFixed(2)} m/s.` : 'The flight ended without a touchdown.';
  return <SceneFrame title={title} detail={detail} reducedMotion={reducedMotion} onComplete={onComplete}>
    {muted => <Cutscene kind="ending" env={env} terrainUrl={terrainUrl} requiredTerrainId={mission.earthAnalog.id} flight={flight} muted={muted} showSkip={false} onDone={onComplete} />}
  </SceneFrame>;
}
