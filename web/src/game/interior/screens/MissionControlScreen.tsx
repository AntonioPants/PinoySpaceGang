import type { MissionConfig, MissionSettings } from '../../../lib/types';
import { overall, type Check } from '../checklist';
import { Checks } from './Checks';

/** The link to mission control: what is being flown, where, and whether it is clear to launch. */
export default function MissionControlScreen({ mission, settings, checks }: { mission: MissionConfig; settings: MissionSettings; checks: Check[] }) {
  const body = mission.planetaryTarget.body, earth = settings.environment === 'earth';
  const score = mission.evidence.quantitativeSimilarityScore;
  const state = overall(checks);
  return <>
    <header><h2>Mission control</h2><span className={`monitor-tag ${state}`}>{state === 'go' ? 'Go for launch' : state === 'caution' ? 'Go with caution' : 'Hold'}</span></header>
    <dl className="monitor-facts">
      <div><dt>Departing from</dt><dd>{mission.planetaryTarget.name}, {body}</dd></div>
      <div><dt>Earth test site</dt><dd>{mission.earthAnalog.name}</dd></div>
      <div><dt>Terrain similarity</dt><dd>{typeof score === 'number' ? `${score.toFixed(2)} of 1 (proposed pairing, terrain shape only)` : 'No pairing proposed for this target'}</dd></div>
      <div><dt>Test physics</dt><dd>{earth ? 'Earth field test: 9.81 m/s², Earth air' : body === 'Moon' ? 'Moon gravity over Earth terrain: 1.62 m/s², vacuum' : `Mars gravity over Earth terrain: ${mission.planetaryTarget.gravity} m/s², thin air`}</dd></div>
    </dl>
    <Checks checks={checks} />
  </>;
}
