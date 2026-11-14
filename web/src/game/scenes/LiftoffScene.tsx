import { Cutscene, type PresetName } from '../../components/cutscene';
import type { SceneProps } from '../contracts';
import { SceneFrame } from './SceneFrame';

/**
 * Furgan's departure cutscene: the lander lights its engine on the planetary site, blasts the
 * dust away and climbs out. The surface is procedural in the site's colours (there is no
 * planetary terrain pack); it illustrates the departure and flies no physics.
 */
export default function LiftoffScene({ mission, reducedMotion, onComplete, immersive }: SceneProps) {
  const target = mission.planetaryTarget;
  const preset: PresetName = target.body === 'Moon' ? 'lunar' : 'mars';
  const env = { name: target.name, subtitle: `Departure for ${mission.earthAnalog.name}`, preset };
  return <SceneFrame title={`Departing ${target.name}`} reducedMotion={reducedMotion} onComplete={onComplete}
    detail={`The lander lifts off from ${target.name} on its way to the Earth analog.`}>
    {muted => <Cutscene fullscreen={immersive} kind="liftoff" env={env} equipment={mission.equipment} muted={muted} showSkip={false} onDone={onComplete} />}
  </SceneFrame>;
}
