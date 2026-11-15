import { useEffect } from 'react';
import { Cutscene, loadTerrainPack, simToPack } from '../../components/cutscene';
import { prepareTerrain } from '../../components/cutscene/terrain';
import { flightSetup } from '../../lib/simulation';
import type { SceneProps } from '../contracts';
import { SceneFrame } from './SceneFrame';
import { sceneEnv } from './sceneEnv';

/**
 * Furgan's departure: the test flight takes off from Earth. A rocket carrying the player's lander
 * (in its livery) lights its engines on the pad, blasts the dust away and climbs out, and the scene
 * dissolves into the Earth approach, where the rocket releases the lander over the analog site. The launch ground is procedural, in the colours of the analog
 * site's region, under Earth's sky, gravity and air; it illustrates the departure and flies no physics.
 *
 * While it plays, the Earth analog's terrain is loaded and painted in the background, so the
 * Earth approach that follows starts without a freeze.
 */
export default function LiftoffScene({ mission, reducedMotion, onComplete, immersive }: SceneProps) {
  const env = { name: 'Earth test range', subtitle: `Test flight to ${mission.earthAnalog.name}`, preset: sceneEnv(mission).env.preset };

  useEffect(() => {
    const ctl = new AbortController(), url = mission.earthAnalog.terrainBaseUrl;
    // Earth approach code and terrain, ready before they are needed
    void import('./EarthApproachScene').catch(() => { /* loads on demand instead */ });
    if (url) void loadTerrainPack(url, ctl.signal)
      .then(pack => prepareTerrain(pack, simToPack(pack, flightSetup(mission).target ?? { x: 0, y: 0 }), 7, ctl.signal))
      .catch(() => { /* the Earth approach paints it itself */ });
    return () => ctl.abort();
  }, [mission]);

  return <SceneFrame title="Liftoff from Earth" reducedMotion={reducedMotion} onComplete={onComplete}
    detail={`A rocket carrying your lander lifts off from Earth on its test flight to ${mission.earthAnalog.name}.`}>
    {muted => <Cutscene fullscreen={immersive} kind="liftoff" env={env} equipment={mission.equipment} muted={muted} showSkip={false} onDone={onComplete} />}
  </SceneFrame>;
}
