import { Cutscene } from '../../components/cutscene';
import { flightSetup } from '../../lib/simulation';
import type { SceneProps } from '../contracts';
import { SceneFrame } from './SceneFrame';
import { sceneEnv } from './sceneEnv';

/**
 * Furgan's opening cutscene: the lander arrives over the Earth analog and hands over exactly at
 * the state the descent simulation starts from. It illustrates the approach; it flies no physics.
 */
export default function EarthApproachScene({ mission, reducedMotion, onComplete, immersive }: SceneProps) {
  const { env, terrainUrl } = sceneEnv(mission);
  const { start, target } = flightSetup(mission);
  return <SceneFrame title={`Approaching ${mission.earthAnalog.name}`} reducedMotion={reducedMotion} onComplete={onComplete}
    detail="The lander arrives 1,000 m above the ground, 400 m west of the target, and the descent begins.">
    {muted => <Cutscene fullscreen={immersive} kind="opening" env={env} terrainUrl={terrainUrl} requiredTerrainId={mission.earthAnalog.id} start={start} target={target} equipment={mission.equipment} muted={muted} showSkip={false} onDone={onComplete} />}
  </SceneFrame>;
}
