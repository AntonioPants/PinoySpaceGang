/**
 * The landing report split into the pages of the bridge monitor's carousel. Every number comes
 * from the flown telemetry, the engine's assessment of it, or the fidelity rehearsal flights;
 * nothing is re-simulated or invented here.
 */
import type { ReactNode } from 'react';
import type { FlightTelemetry } from '../../../../app/sim/src/types';
import { SCORING } from '../../../../app/sim/src/assessment';
import type { MissionConfig, TerrainProfile } from '../../lib/types';
import type { FidelityReport } from '../../lib/fidelity';
import { LANDFORM_RELATION, percent, type MatchCheck } from '../../lib/matching';
import { debriefFor, gearRows, rehearsalRows } from '../../lib/debrief';
import LandingEvidence from '../../components/LandingEvidence';

export type FidelityState = { status: 'working' } | { status: 'done'; result: FidelityReport } | { status: 'unavailable'; reason: string };
export interface DebriefSection { id: string; title: string; content: ReactNode }
export interface SectionInput { flight: FlightTelemetry; mission: MissionConfig; profile: TerrainProfile; match?: MatchCheck; fidelity: FidelityState }

const SOURCE_LABEL: Record<string, string> = { soilType: 'Surface material', albedo: 'Albedo', sunElevationDeg: 'Sun elevation', wind_speed_10m: 'Wind speed', wind: 'Wind', airDensity: 'Air density', rock_abundance: 'Rock abundance' };
const outOf100 = (v: number | null) => (v === null ? '–' : `${v} / 100`);
const reached = (m: number) => (m < 0.5 ? 'Reached' : `${m.toFixed(1)} m`);

function Tiles({ items, columns = 3, hero = false }: { items: Array<[string, ReactNode, ReactNode?]>; columns?: 3 | 4; hero?: boolean }) {
  return <dl className={`deb-tiles cols-${columns}${hero ? ' hero' : ''}`}>{items.map(([name, value, note]) => <div key={name}><dt>{name}</dt><dd>{value}</dd>{note && <small>{note}</small>}</div>)}</dl>;
}
function Findings({ title, items }: { title: string; items: { code: string; text: string }[] }) {
  return items.length ? <><h4>{title}</h4><ul className="deb-list">{items.map(f => <li key={f.code}>{f.text}</li>)}</ul></> : null;
}
function Pending({ fidelity, body }: { fidelity: FidelityState; body: string }) {
  return fidelity.status === 'working'
    ? <p className="deb-pending" role="status">Rehearsal flights still running over {body}’s terrain and the Earth site…</p>
    : <p className="deb-pending">No rehearsal comparison: {fidelity.status === 'unavailable' ? fidelity.reason : 'not available'}</p>;
}

export function buildSections({ flight, mission, profile, match, fidelity }: SectionInput): DebriefSection[] {
  const result = flight.summary!, env = flight.environment;
  const a = debriefFor(flight, mission), { stats: s, scores } = a;
  const body = mission.planetaryTarget.body, timeout = result.outcome === 'timeout';
  const done = fidelity.status === 'done' ? fidelity.result : null;
  const rehearsal = done ? rehearsalRows(flight, done.guided) : null;
  const siteData = mission.environment.interferenceSource === 'site' ? 'from site data' : 'manual';
  const contact = (value: string) => (timeout ? 'No touchdown' : value);

  const sections: DebriefSection[] = [
    { id: 'touchdown', title: 'Touchdown', content: <>
      <div className={`mon-banner ${result.outcome === 'success' ? 'go' : 'hold'}`}>{result.outcome === 'success' ? 'Touchdown complete' : `Flight ended · ${result.outcome}`}</div>
      <p className="deb-lede">{mission.environment.mode === 'earth' ? 'Earth field test' : `${body} physics scenario`} on {mission.earthAnalog.name}, comparing with {mission.planetaryTarget.name}. A simulated outcome, not an engineering certification.</p>
      <Tiles items={[
        ['Vertical contact speed', contact(`${result.verticalSpeedMps.toFixed(2)} m/s`)],
        ['Lateral contact speed', contact(`${result.horizontalSpeedMps.toFixed(2)} m/s`)],
        ['Ground slope', contact(`${result.slopeDeg.toFixed(2)}°`)],
        ['Vehicle tilt', `${result.tiltDeg.toFixed(2)}°`],
        ['Fuel remaining', `${result.fuelRemainingKg.toFixed(1)} kg`],
        ['Distance from target', reached(result.distanceFromTargetM)],
      ]} />
      <h4>What happened</h4>
      {result.failureReasons.length ? <ul className="deb-list">{result.failureReasons.map(r => <li key={r}>{r}</li>)}</ul>
        : <p>The simulated touchdown stayed within this vehicle’s speed, slope, tilt and roughness limits.</p>}
      <h4>What Earth cannot reproduce</h4>
      <p className="deb-note">{mission.planetaryTarget.name} has {mission.planetaryTarget.gravity} m/s² gravity and {body === 'Moon' ? 'a vacuum' : 'a thin carbon-dioxide atmosphere'}; the Earth site has 9.81 m/s² and Earth air. This flight ran at {mission.environment.gravityMs2} m/s² and {Number(env.airDensity.toFixed(3))} kg/m³. Radiation is not simulated, and the terrain cannot reproduce it.</p>
    </> },
    { id: 'assessment', title: 'Landing assessment', content: <>
      <Tiles columns={4} hero items={[
        ['Overall', <><b className="deb-grade">{scores.grade}</b> {scores.overall} / 100</>],
        ['Survivability', outOf100(scores.safety), 'how far inside the touchdown limits'],
        ['Precision', outOf100(scores.precision), a.touchedDown ? (s.distanceFromAimM < 0.5 ? 'reached the aim point' : `${s.distanceFromAimM.toFixed(1)} m from the aim point`) : 'no touchdown'],
        ['Fuel efficiency', outOf100(scores.efficiency), scores.efficiency === null ? 'not scored for this outcome' : 'unbraked arrival speed ÷ delta-v spent'],
      ]} />
      <p className="deb-note">Overall = {SCORING.weights.safety * 100}% survivability + {SCORING.weights.precision * 100}% precision + {SCORING.weights.efficiency * 100}% fuel efficiency, capped by the outcome. These are game scores for comparing flights in this simulator, not engineering ratings.</p>
    </> },
    { id: 'limits', title: 'Touchdown against limits', content: <>
      {a.margins.length ? <ul className="deb-margins">{a.margins.map(m => <li key={m.key} className={m.status}>
        <span>{m.label}</span>
        <div className="deb-track" role="img" aria-label={`${m.label}: ${Math.round(m.ratio * 100)} percent of the limit`}><i style={{ width: `${Math.min(m.ratio, 1) * 100}%` }} /></div>
        <b>{m.value.toFixed(m.unit === '°' ? 1 : 2)} / {m.limit} {m.unit}</b>
        <em>{Math.round(m.ratio * 100)}%{m.status === 'exceeded' ? ' · over limit' : m.status === 'marginal' ? ' · marginal' : ' of limit'}</em>
      </li>)}</ul> : <p>The vehicle never touched down, so there are no contact readings to compare with its limits.</p>}
      {gearRows(flight).length > 0 && <p className="deb-note">Landing gear · {gearRows(flight).map(([name, value]) => `${name}: ${value}`).join(' · ')}</p>}
      <Findings title="Why the flight ended this way" items={a.causes} />
      <Findings title={a.causes.length ? 'Contributing conditions' : 'Worth noting'} items={a.factors} />
      <Findings title="For the next flight" items={a.recommendations} />
    </> },
    { id: 'statistics', title: 'Flight statistics', content: <Tiles columns={4} items={[
      ['Flight time', `${s.flightTimeS.toFixed(1)} s`], ['Peak descent rate', `${s.peakDescentRateMps.toFixed(1)} m/s`],
      ['Peak deceleration', `${s.peakDecelG.toFixed(2)} g`], ['Maximum tilt in flight', `${s.maxTiltDeg.toFixed(1)}°`],
      ['Engine burn time', `${s.burnTimeS.toFixed(1)} s`], ['Mean throttle while lit', `${Math.round(s.meanThrottle * 100)}%`],
      ['Fuel used', `${s.fuelUsedKg.toFixed(0)} of ${s.fuelLoadedKg.toFixed(0)} kg`], ['Fuel reserve', `${Math.round(s.fuelReserveFraction * 100)}%`],
      ['Delta-v spent', `${s.deltaVUsedMps.toFixed(0)} m/s`], ['Unbraked arrival speed', `${s.deltaVIdealMps.toFixed(0)} m/s`],
      ['Thrust-to-weight at ignition', s.thrustToWeight.toFixed(2)], ['Ground track', `${s.groundTrackM.toFixed(0)} m`],
      ['Hazards detected', String(s.hazardsDetected)], ['Diverts', s.diverts ? `${s.diverts}, ${s.divertDistanceM.toFixed(0)} m` : 'None'],
      ['Miss from aim point', reached(s.distanceFromAimM)],
      ['Fuel exhausted', s.fuelOutAtS === null ? 'No' : `T+${s.fuelOutAtS.toFixed(1)} s, ${s.fuelOutAltitudeM!.toFixed(0)} m up`],
    ]} /> },
    { id: 'rehearsal', title: 'Rehearsal flights', content: rehearsal && done ? <>
      <table className="deb-table">
        <thead><tr><th scope="col">Touchdown</th><th scope="col">This flight</th><th scope="col">{body} terrain, mean</th><th scope="col">Earth analog, mean</th></tr></thead>
        <tbody>{rehearsal.map(r => <tr key={r.label}><th scope="row">{r.label}</th>{[r.flown, r.planetary, r.analog].map((v, i) => <td key={i}>{v.toFixed(r.digits)} {r.unit}</td>)}</tr>)}</tbody>
      </table>
      <p className="deb-note">The rehearsal columns are means of {done.guided.seeds.length} autonomous landings under {body} gravity over each terrain. This flight used the mission settings as flown{mission.strategy.mode === 'MANUAL_CONTROL' ? ', under manual control' : ''}, so differences can come from the conditions as well as the terrain.</p>
    </> : done ? <p className="deb-pending">This flight never touched down, so there is no touchdown to set beside the rehearsal flights.</p> : <Pending fidelity={fidelity} body={body} /> },
    { id: 'fidelity', title: 'Analog fidelity', content: done ? <>
      <Tiles items={[
        ['Stress test score', `${done.stress.score} / 100`, 'blind landings'],
        ['Guided flight score', `${done.guided.score} / 100`],
        ['Guided outcome', [...done.guided.planetary.outcomes, ...done.guided.analog.outcomes].every(o => o === 'success') ? 'Success' : 'Failure'],
        [`Landable share · ${body}`, `${Math.round(done.stress.planetary.successRate * 100)}%`],
        ['Landable share · Earth', `${Math.round(done.stress.analog.successRate * 100)}%`],
        [`Touchdown slope · ${body} / Earth`, `${done.stress.planetary.meanSlopeDeg.toFixed(1)}° / ${done.stress.analog.meanSlopeDeg.toFixed(1)}°`],
      ]} />
      <h4>Catalog landing baseline</h4>
      <LandingEvidence compact targetId={mission.planetaryTarget.id} earthId={mission.earthAnalog.id} />
      <p className="deb-note"><strong>Stress test:</strong> {done.stress.method} It shows how much of each terrain is landable without hazard avoidance. <strong>Guided:</strong> {done.guided.seeds.length} hazard-avoiding landings at the centre of each terrain, scored on outcome agreement, touchdown speeds, ground slope and roughness, and fuel used.</p>
      <p className="deb-note">These compare simulated flights over two elevation grids, not geology or soil mechanics. The planetary grid ({body === 'Moon' ? '150' : '500'} m per sample) is far coarser than the Earth grid ({profile.sampleSpacingM} m), so planetary terrain looks smoother than it is.</p>
    </> : <Pending fidelity={fidelity} body={body} /> },
    { id: 'match', title: 'Analog match', content: match ? <>
      <Tiles items={[
        ['Analog match', percent(match.analog_score_percent)],
        ['Landform', match.landform ? LANDFORM_RELATION[match.landform.relation] : 'Not established'],
        ['Terrain match', percent(match.terrain_similarity_percent)],
        ['Catalog rank', String(match.candidate_rank)],
        ['Basis', match.evidence_status === 'literature_informed_proposal' ? 'Literature-informed proposal' : 'Terrain only, exploratory'],
      ]} />
      <p className="deb-note">Analog match is half landform type and half terrain shape, computed before the flight{match.total_similarity_percent === null ? '; no environment comparison (wind, temperature, albedo) is available for this pair' : ''}. It is not scientifically validated and is separate from the flight scores.</p>
    </> : <p className="deb-pending">No catalog pairing is recorded for {mission.earthAnalog.name} and {mission.planetaryTarget.name}, so there is no pre-flight match score.</p> },
    { id: 'conditions', title: 'Site conditions', content: <>
      <Tiles items={[
        ['Gravity', `${env.gravity} m/s²`], ['Air density', `${Number(env.airDensity.toFixed(3))} kg/m³`],
        ['Wind', `${Math.hypot(env.wind.x, env.wind.y).toFixed(1)} m/s`, mission.environment.realWeather ? 'real modelled hour' : 'scenario setting'],
        ['Dust interference', `${Math.round(env.interference.dust * 100)}%`, siteData],
        ['Glare interference', `${Math.round(env.interference.glare * 100)}%`, siteData],
        ['Hazard sensor', mission.strategy.hazardSensor === 'none' ? 'None' : mission.strategy.hazardSensor],
      ]} />
      {Object.keys(env.sources).length > 0 && <ul className="deb-list">{Object.entries(env.sources).map(([key, value]) => <li key={key}>{SOURCE_LABEL[key] ?? key}: {value}</li>)}</ul>}
      <p className="deb-note">{env.rocksGenerated > 0 ? `${env.rocksGenerated} boulders were generated from a rock abundance of ${(env.rockAbundance * 100).toFixed(1)}%.` : 'No rock-abundance data exists for this site, so the terrain has no boulders.'} The {profile.sampleSpacingM} m grid cannot establish footpad-scale landing safety. {result.diverted ? 'Guidance diverted from the initial target.' : 'No hazard-avoidance diversion was recorded.'}</p>
    </> },
  ];
  return sections;
}

/** Carousel step that wraps round both ends. */
export const stepIndex = (index: number, delta: number, count: number) => ((index + delta) % count + count) % count;
