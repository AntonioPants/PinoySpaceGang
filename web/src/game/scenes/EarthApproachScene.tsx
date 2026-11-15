import { useEffect } from 'react';
import { Cutscene } from '../../components/cutscene';
import { flightSetup } from '../../lib/simulation';
import type { SceneProps } from '../contracts';
import { SceneFrame } from './SceneFrame';
import { sceneEnv } from './sceneEnv';

/**
 * Furgan's opening cutscene: the rocket arrives over the Earth analog, drops its boosters, opens its
 * fairing and releases the lander, which deploys its landing gear and hands over exactly at
 * the state the descent simulation starts from. It illustrates the approach; it flies no physics.
 */
export default function EarthApproachScene({ mission, reducedMotion, onComplete, immersive }: SceneProps) {
  const { env, terrainUrl } = sceneEnv(mission);
  const { start, target } = flightSetup(mission);
  // Fetch the descent screen's code while the opening plays, so the hand-over does not wait for it.
  useEffect(() => { void import('../../components/Descent').then(m => m.preloadDescent3D()).catch(() => { /* loads on demand instead */ }); }, []);
  return <SceneFrame title={`Approaching ${mission.earthAnalog.name}`} reducedMotion={reducedMotion} onComplete={onComplete}
    detail="The rocket drops its boosters and releases the lander, which deploys its landing gear 1,000 m above the ground, 400 m west of the target, and the descent begins.">
    {muted => <Cutscene fullscreen={immersive} kind="opening" env={env} terrainUrl={terrainUrl} requiredTerrainId={mission.earthAnalog.id} start={start} target={target} equipment={mission.equipment} muted={muted} showSkip={false} onDone={onComplete} />}
  </SceneFrame>;
}
