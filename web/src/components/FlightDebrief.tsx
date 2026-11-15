/**
 * Landing assessment shared by the standard and the 1976-manual report views. All numbers come
 * from assessFlight() over the actual flight telemetry; nothing here is re-simulated.
 */
import { useMemo } from 'react';
import type { FlightTelemetry } from '../../../app/sim/src/types';
import { SCORING } from '../../../app/sim/src/assessment';
import type { MissionConfig } from '../lib/types';
import type { FidelityReport } from '../lib/fidelity';
import { LANDFORM_RELATION, percent, type MatchCheck } from '../lib/matching';
import { debriefFor, gearRows, rehearsalRows } from '../lib/debrief';
import './debrief.css';

const score = (v: number | null) => (v === null ? '–' : `${v} / 100`);
const miss = (m: number) => (m < 0.5 ? 'Reached' : `${m.toFixed(1)} m`);

export default function FlightDebrief({ flight, mission, fidelity, match }: { flight: FlightTelemetry; mission: MissionConfig; fidelity?: FidelityReport | null; match?: MatchCheck }) {
  const a = useMemo(() => debriefFor(flight, mission), [flight, mission]);
  const { stats: s, scores } = a;
  const rehearsal = fidelity ? rehearsalRows(flight, fidelity.guided) : null;
  const body = mission.planetaryTarget.body;
  const statistics: Array<[string, string]> = [
    ['Flight time', `${s.flightTimeS.toFixed(1)} s`],
    ['Peak descent rate', `${s.peakDescentRateMps.toFixed(1)} m/s`],
    ['Peak deceleration', `${s.peakDecelG.toFixed(2)} g`],
    ['Maximum tilt in flight', `${s.maxTiltDeg.toFixed(1)}°`],
    ['Engine burn time', `${s.burnTimeS.toFixed(1)} s`],
    ['Mean throttle while lit', `${Math.round(s.meanThrottle * 100)}%`],
    ['Fuel used', `${s.fuelUsedKg.toFixed(0)} of ${s.fuelLoadedKg.toFixed(0)} kg`],
    ['Fuel reserve', `${Math.round(s.fuelReserveFraction * 100)}%`],
    ['Delta-v spent', `${s.deltaVUsedMps.toFixed(0)} m/s`],
    ['Unbraked arrival speed', `${s.deltaVIdealMps.toFixed(0)} m/s`],
    ['Thrust-to-weight at ignition', s.thrustToWeight.toFixed(2)],
    ['Ground track', `${s.groundTrackM.toFixed(0)} m`],
    ['Hazards detected', String(s.hazardsDetected)],
    ['Diverts', s.diverts ? `${s.diverts}, ${s.divertDistanceM.toFixed(0)} m` : 'None'],
    ['Miss from aim point', miss(s.distanceFromAimM)],
    ['Fuel exhausted', s.fuelOutAtS === null ? 'No' : `T+${s.fuelOutAtS.toFixed(1)} s, ${s.fuelOutAltitudeM!.toFixed(0)} m up`],
    ...gearRows(flight),
  ];
  return <section className="debrief" aria-label="Landing assessment">
    <h3>Landing assessment</h3>
    <div className="debrief-scores">
      <div><span>Overall</span><strong>{scores.grade}</strong><small>{scores.overall} / 100</small></div>
      <div><span>Survivability</span><strong>{score(scores.safety)}</strong><small>how far inside the touchdown limits</small></div>
      <div><span>Precision</span><strong>{score(scores.precision)}</strong><small>{a.touchedDown ? (s.distanceFromAimM < 0.5 ? 'reached the aim point' : `${s.distanceFromAimM.toFixed(1)} m from the aim point`) : 'no touchdown'}</small></div>
      <div><span>Fuel efficiency</span><strong>{score(scores.efficiency)}</strong><small>{scores.efficiency === null ? 'not scored for this outcome' : 'unbraked arrival speed ÷ delta-v spent'}</small></div>
    </div>
    <p className="debrief-small">Overall = {SCORING.weights.safety * 100}% survivability + {SCORING.weights.precision * 100}% precision + {SCORING.weights.efficiency * 100}% fuel efficiency, capped by the outcome. These are game scores for comparing flights in this simulator, not engineering ratings.</p>

    {a.margins.length > 0 && <>
      <h4>Touchdown against limits</h4>
      <ul className="debrief-margins">{a.margins.map(m => <li key={m.key} className={m.status}>
        <span>{m.label}</span>
        <div className="debrief-track" role="img" aria-label={`${m.label}: ${Math.round(m.ratio * 100)} percent of the limit`}><i style={{ width: `${Math.min(m.ratio, 1) * 100}%` }} /></div>
        <b>{m.value.toFixed(m.unit === '°' ? 1 : 2)} / {m.limit} {m.unit}</b>
        <em>{Math.round(m.ratio * 100)}%{m.status === 'exceeded' ? ' · over limit' : m.status === 'marginal' ? ' · marginal' : ' of limit'}</em>
      </li>)}</ul>
    </>}

    {a.causes.length > 0 && <><h4>Why the flight ended this way</h4><ul className="debrief-list">{a.causes.map(f => <li key={f.code}>{f.text}</li>)}</ul></>}
    {a.factors.length > 0 && <><h4>{a.causes.length ? 'Contributing conditions' : 'Worth noting'}</h4><ul className="debrief-list">{a.factors.map(f => <li key={f.code}>{f.text}</li>)}</ul></>}
    {a.recommendations.length > 0 && <><h4>For the next flight</h4><ul className="debrief-list">{a.recommendations.map(f => <li key={f.code}>{f.text}</li>)}</ul></>}

    <h4>Flight statistics</h4>
    <dl className="debrief-stats">{statistics.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>

    {rehearsal && <>
      <h4>Your touchdown beside the rehearsal flights</h4>
      <table className="debrief-table">
        <thead><tr><th scope="col">Touchdown</th><th scope="col">This flight</th><th scope="col">{body} terrain, mean</th><th scope="col">Earth analog, mean</th></tr></thead>
        <tbody>{rehearsal.map(r => <tr key={r.label}><th scope="row">{r.label}</th>{[r.flown, r.planetary, r.analog].map((v, i) => <td key={i}>{v.toFixed(r.digits)} {r.unit}</td>)}</tr>)}</tbody>
      </table>
      <p className="debrief-small">The rehearsal columns are means of {fidelity!.guided.seeds.length} autonomous landings under {body} gravity over each terrain. This flight used the mission settings as flown{mission.strategy.mode === 'MANUAL_CONTROL' ? ', under manual control' : ''}, so differences can come from the conditions as well as the terrain.</p>
    </>}

    {match && <>
      <h4>Analog match evidence</h4>
      <dl className="debrief-stats">
        <div><dt>Analog match</dt><dd>{percent(match.analog_score_percent)}</dd></div>
        {match.landform && <div><dt>Landform</dt><dd>{LANDFORM_RELATION[match.landform.relation]}</dd></div>}
        <div><dt>Terrain match</dt><dd>{percent(match.terrain_similarity_percent)}</dd></div>
        {match.total_similarity_percent !== null && <>
          <div><dt>Environment match</dt><dd>{percent(match.environment_similarity_percent)}</dd></div>
          <div><dt>Overall match</dt><dd>{percent(match.total_similarity_percent)}</dd></div>
        </>}
        <div><dt>Catalog rank</dt><dd>{match.candidate_rank}</dd></div>
        <div><dt>Basis</dt><dd>{match.evidence_status === 'literature_informed_proposal' ? 'Literature-informed proposal' : 'Terrain only, exploratory'}</dd></div>
      </dl>
      <p className="debrief-small">{match.total_similarity_percent === null ? 'Analog match is half landform type and half terrain shape; no environment comparison (wind, temperature, albedo) is available. ' : ''}Catalog similarity of the two locations, computed before the flight. It is not scientifically validated and is separate from the flight scores above.</p>
    </>}
  </section>;
}
