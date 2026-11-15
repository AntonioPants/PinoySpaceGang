/**
 * The analog report, split into the pages of the bridge monitor's carousel.
 *
 * It is organised around the question the project exists to answer: why is this Earth site
 * an analog for this Moon or Mars site? The first pages say what matches and where the analogy
 * breaks down; the middle pages compare terrain, environment and landing behaviour; the last
 * pages report the flight that was actually flown.
 *
 * Every number comes from the flown telemetry, the engine's assessment of it, the catalog's
 * record of the pair, or the rehearsal flights. Nothing is re-simulated or invented here, and
 * what the catalog does not know is shown as not established.
 */
import { lazy, Suspense, type ReactNode } from 'react';
import type { FlightTelemetry } from '../../../../app/sim/src/types';
import type { CatalogSite } from '../../../../app/sim/src/catalog';
import { SCORING } from '../../../../app/sim/src/assessment';
import type { MissionConfig, TerrainProfile } from '../../lib/types';
import type { FidelityReport } from '../../lib/fidelity';
import { LANDFORM_RELATION, percent, type MatchCheck } from '../../lib/matching';
import { debriefFor, gearRows, rehearsalRows } from '../../lib/debrief';
import LandingEvidence from '../../components/LandingEvidence';
import LanderSchematic, { subsystemReadings } from './LanderSchematic';

// Side-by-side 3D view of both terrains (Codex's module); loaded with the page that shows it.
const TerrainComparison3D = lazy(() => import('./TerrainComparison3D'));

export type FidelityState = { status: 'working' } | { status: 'done'; result: FidelityReport } | { status: 'unavailable'; reason: string };
export interface DebriefSection { id: string; title: string; content: ReactNode }
/** The catalog's written evidence for the pair: why it matches, where it breaks down, and a source. */
export interface PairEvidence { matches: string[]; differences: string[]; source?: string }
export interface SectionInput {
  flight: FlightTelemetry; mission: MissionConfig; profile: TerrainProfile; match?: MatchCheck; evidence?: PairEvidence; fidelity: FidelityState;
  /** Catalog records of both sites and the target's own terrain, when loaded. */
  analogEntry?: CatalogSite; planetaryEntry?: CatalogSite; targetProfile?: TerrainProfile;
}

const SOURCE_LABEL: Record<string, string> = { soilType: 'Surface material', albedo: 'Albedo', sunElevationDeg: 'Sun elevation', wind_speed_10m: 'Wind speed', wind: 'Wind', airDensity: 'Air density', rock_abundance: 'Rock abundance' };
const PROPERTY_LABEL: Record<string, string> = { wind_speed_10m: 'Wind speed at 10 m', air_temperature_2m: 'Air temperature at 2 m', surface_temperature: 'Surface temperature', albedo: 'Albedo' };
const outOf100 = (v: number | null) => (v === null ? '–' : `${v} / 100`);
const reached = (m: number) => (m < 0.5 ? 'Reached' : `${m.toFixed(1)} m`);
const words = (label: string | null | undefined) => (label ? label.replaceAll('_', ' ') : 'Unknown');
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const basis = (match: MatchCheck) => (match.evidence_status === 'literature_informed_proposal' ? 'Literature-informed proposal' : 'Terrain only, exploratory');
const air = (body: string) => (body === 'Moon' ? 'a vacuum' : 'a thin carbon-dioxide atmosphere');

function Tiles({ items, columns = 3, hero = false, compact = false }: { items: Array<[string, ReactNode, ReactNode?]>; columns?: 3 | 4 | 6; hero?: boolean; compact?: boolean }) {
  return <dl className={`deb-tiles cols-${columns}${hero ? ' hero' : ''}${compact ? ' compact' : ''}`}>{items.map(([name, value, note]) => <div key={name}><dt>{name}</dt><dd>{value}</dd>{note && <small>{note}</small>}</div>)}</dl>;
}
function Findings({ title, items }: { title: string; items: { code: string; text: string }[] }) {
  return items.length ? <><h4>{title}</h4><ul className="deb-list">{items.map(f => <li key={f.code}>{f.text}</li>)}</ul></> : null;
}
function Pending({ fidelity, body }: { fidelity: FidelityState; body: string }) {
  return fidelity.status === 'working'
    ? <p className="deb-pending" role="status">Rehearsal flights still running over {body}’s terrain and the Earth site…</p>
    : <p className="deb-pending">No rehearsal comparison: {fidelity.status === 'unavailable' ? fidelity.reason : 'not available'}</p>;
}

export function buildSections(input: SectionInput): DebriefSection[] {
  const { flight, mission, profile, match, evidence, fidelity, analogEntry, planetaryEntry, targetProfile } = input;
  const result = flight.summary!, env = flight.environment;
  const a = debriefFor(flight, mission), { stats: s, scores } = a;
  const target = mission.planetaryTarget, earth = mission.earthAnalog, body = target.body, timeout = result.outcome === 'timeout';
  const done = fidelity.status === 'done' ? fidelity.result : null;
  const rehearsal = done ? rehearsalRows(flight, done.guided) : null;
  const siteData = mission.environment.interferenceSource === 'site' ? 'from site data' : 'manual';
  const contact = (value: string) => (timeout ? 'No touchdown' : value);
  const statistics = profile.manifest.statistics;
  const compared = match?.environment_features.filter(f => f.similarity_percent !== null) ?? [];
  const planetaryGrid = body === 'Moon' ? 150 : 500;
  const subsystems = subsystemReadings({ flight, mission, assessment: a, fidelity: done, rehearsal, analogEntry, planetaryEntry });
  const surface = surfaceOpsAssessment(input);
  const dimensions = analogDimensions(input);
  const named = (fit: Fit) => dimensions.filter(d => d.fit === fit).map(d => d.short);

  return [
    { id: 'why', title: 'Why this analog', content: <>
      <div className={`deb-status ${result.outcome === 'success' ? 'go' : 'hold'}`}>{result.outcome === 'success' ? 'Field test complete' : `Field test ended · ${result.outcome}`}</div>
      <p className="deb-lede">{target.name} is a candidate {body === 'Moon' ? 'lunar' : 'Martian'} exploration site that cannot be rehearsed in place. {earth.name} is an Earth site proposed to stand in for it, so the same lander can be flown over measured ground before it flies there.</p>
      {match ? <Tiles items={[
        ['Analog match', percent(match.analog_score_percent), 'half landform type, half terrain shape'],
        ['Landform', match.landform ? LANDFORM_RELATION[match.landform.relation] : 'Not established'],
        ['Terrain match', percent(match.terrain_similarity_percent)],
        ['Basis', basis(match)],
        ['Catalog rank', String(match.candidate_rank), 'among this target’s Earth candidates'],
        ['Test physics', `${mission.environment.gravityMs2} m/s²`, mission.environment.mode === 'earth' ? 'Earth field test' : `${body} gravity and air`],
      ]} /> : <p className="deb-pending">No catalog pairing is recorded for {earth.name} and {target.name}, so there is no pre-flight match score.</p>}
      <h4>Why it matches</h4>
      <ul className="deb-list">{(evidence?.matches.length ? evidence.matches : ['No pair-specific match evidence has been reviewed; the comparison rests on terrain shape alone.']).map(text => <li key={text}>{text}</li>)}</ul>
      <p className="deb-note">The match score is an engineering similarity computed before the flight. It is not scientifically validated and is separate from the flight scores.{evidence?.source && <> <a href={evidence.source} target="_blank" rel="noreferrer">Supporting source</a></>}</p>
    </> },

    { id: 'dimensions', title: 'What is similar, how similar, and what is not', content: <>
      <div className="deb-dims">{dimensions.map(d => <article key={d.id} className={`deb-dim ${d.fit}`}>
        <header><h4>{d.name}</h4><span>{FIT_WORD[d.fit]}</span></header>
        <p>{d.evidence}</p>
        <small>{d.source}</small>
      </article>)}</div>
      <p className="deb-verdict">
        {named('strong').length > 0 && <><b className="go">Rehearse here:</b> {named('strong').join(', ')}. </>}
        {named('poor').length > 0 && <><b className="hold">Do not rely on it for:</b> {named('poor').join(', ')}. </>}
        {named('unknown').length > 0 && <><b>Not established yet:</b> {named('unknown').join(', ')}.</>}
      </p>
      <p className="deb-note">Ratings sort the measured values into bands (terrain: 70% and above strong, 50–70% partial); they are not validated accuracy. No Earth site reproduces another world in every dimension.</p>
    </> },

    { id: 'breaks-down', title: 'Where the analogy breaks down', content: <>
      <p className="deb-lede">No place on Earth reproduces {body === 'Moon' ? 'the Moon' : 'Mars'}. Knowing where this pairing stops being useful matters as much as knowing where it holds.</p>
      <h4>Differences recorded for this pair</h4>
      <ul className="deb-list">{(evidence?.differences.length ? evidence.differences.slice(0, 4) : ['No pair-specific differences have been reviewed for these two sites.']).map(text => <li key={text}>{text}</li>)}</ul>
      <h4>What Earth cannot reproduce</h4>
      <ul className="deb-list">
        <li><strong>Gravity:</strong> {target.name} has {target.gravity} m/s²; Earth has 9.81 m/s². This flight ran at {mission.environment.gravityMs2} m/s².</li>
        <li><strong>Atmosphere:</strong> {target.name} has {air(body)}; the Earth site has Earth air. This flight ran at {Number(env.airDensity.toFixed(3))} kg/m³.</li>
        <li><strong>Radiation:</strong> not simulated, and the terrain cannot reproduce it.</li>
        <li><strong>Surface materials:</strong> the simulation flies over measured elevation only. Regolith mechanics and chemistry at the target are not modelled.</li>
      </ul>
      <h4>Limits of the data</h4>
      <ul className="deb-list">
        <li>The Earth grid has one sample every {profile.sampleSpacingM} m and the {body} grid one every {planetaryGrid} m, so {body} terrain looks smoother than it is and neither grid shows footpad-scale hazards.</li>
        <li>{env.rocksGenerated > 0 ? `${env.rocksGenerated} boulders were generated from a rock abundance of ${(env.rockAbundance * 100).toFixed(1)}%.` : 'No rock-abundance data exists for this site, so the terrain has no boulders.'}</li>
      </ul>
    </> },

    { id: 'terrain', title: 'Terrain and geology', content: <>
      <Tiles columns={6} compact items={[
        ['Terrain match', match ? percent(match.terrain_similarity_percent) : 'Not established'],
        ['Landform', match?.landform ? LANDFORM_RELATION[match.landform.relation] : 'Not established'],
        ['Slope at touchdown', contact(`${result.slopeDeg.toFixed(2)}°`)],
        ['Earth relief', statistics ? `${statistics.relief_m.toFixed(1)} m` : 'Not recorded'],
        ['Earth slope, P95', statistics?.slope_p95_deg != null ? `${statistics.slope_p95_deg.toFixed(1)}°` : 'Not recorded'],
        ['Grid spacing', `${profile.sampleSpacingM} m · ${planetaryGrid} m`, `Earth · ${body}`],
      ]} />
      {match && <p className="deb-geology"><strong>Catalog interpretation</strong> · Earth: {words(match.geology.earth_morphology)}, {words(match.geology.earth_substrate)} · {body}: {words(match.geology.planetary_morphology)}, {words(match.geology.planetary_substrate)}</p>}
      {targetProfile && <div className="deb-terrain3d">
        <Suspense fallback={<p className="deb-pending" role="status">Loading the 3D terrain comparison…</p>}>
          {/* The flight landed on the Earth analog, so its point is an Earth-side marker, never a target landing. */}
          <TerrainComparison3D earthProfile={profile} targetProfile={targetProfile} earthEntry={analogEntry} targetEntry={planetaryEntry}
            rehearsalPoints={timeout ? [] : [{ x: result.landingPoint.x, y: result.landingPoint.y, label: 'This flight', footprintRadiusM: flight.lander.legRadiusM }]} />
        </Suspense>
      </div>}
      <p className="deb-note">Terrain match compares slope, roughness, relief and landform shape over the same 4 km window; shapes can agree while rock type and origin differ.</p>
    </> },

    { id: 'environment', title: 'Environment and conditions', content: <>
      <Tiles items={[
        ['Gravity flown', `${env.gravity} m/s²`, `${target.name}: ${target.gravity} · Earth: 9.81`],
        ['Air density flown', `${Number(env.airDensity.toFixed(3))} kg/m³`],
        ['Wind', `${Math.hypot(env.wind.x, env.wind.y).toFixed(1)} m/s`, mission.environment.realWeather ? 'real modelled hour' : 'scenario setting'],
        ['Dust interference', `${Math.round(env.interference.dust * 100)}%`, siteData],
        ['Glare interference', `${Math.round(env.interference.glare * 100)}%`, siteData],
        ['Hazard sensor', mission.strategy.hazardSensor === 'none' ? 'None' : mission.strategy.hazardSensor],
      ]} />
      <h4>Environment comparison</h4>
      {match ? compared.length
        ? <ul className="deb-list">{compared.map(f => <li key={f.property}><strong>{PROPERTY_LABEL[f.property] ?? words(f.property)}:</strong> {f.similarity_percent!.toFixed(0)}% similar. {f.reason}</li>)}</ul>
        : <p>Not established. Wind, air temperature, surface temperature and albedo have no reviewed, comparable measurements for both sites, so this pair is scored on landform and terrain only.</p>
        : <p className="deb-pending">No environment comparison is available without a catalog pairing.</p>}
      {match && <p className="deb-note"><strong>Atmosphere:</strong> Earth has a {match.atmosphere.earth}; {target.name} is {match.atmosphere.planetary}. {match.atmosphere.reason}</p>}
      {Object.keys(env.sources).length > 0 && <><h4>Where the site conditions come from</h4><ul className="deb-list">{Object.entries(env.sources).map(([key, value]) => <li key={key}>{SOURCE_LABEL[key] ?? key}: {value}</li>)}</ul></>}
    </> },

    { id: 'fidelity', title: 'Landing behaviour on both terrains', content: done ? <>
      <p className="deb-lede">Does landing here predict landing at {target.name}? The same vehicle is flown automatically over both terrains under {body} gravity.</p>
      <Tiles items={[
        ['Stress test score', `${done.stress.score} / 100`, 'blind landings across each terrain'],
        ['Guided flight score', `${done.guided.score} / 100`, 'hazard-avoiding landings'],
        ['Guided outcome', [...done.guided.planetary.outcomes, ...done.guided.analog.outcomes].every(o => o === 'success') ? 'Success' : 'Failure'],
        [`Landable share · ${body}`, `${Math.round(done.stress.planetary.successRate * 100)}%`],
        ['Landable share · Earth', `${Math.round(done.stress.analog.successRate * 100)}%`],
        [`Touchdown slope · ${body} / Earth`, `${done.stress.planetary.meanSlopeDeg.toFixed(1)}° / ${done.stress.analog.meanSlopeDeg.toFixed(1)}°`],
      ]} />
      <h4>Catalog landing baseline</h4>
      <LandingEvidence compact targetId={target.id} earthId={earth.id} />
      <p className="deb-note"><strong>Stress test:</strong> {done.stress.method} <strong>Guided:</strong> {done.guided.seeds.length} hazard-avoiding landings at the centre of each terrain. These compare simulated flights over two elevation grids, not geology or soil mechanics.</p>
    </> : <Pending fidelity={fidelity} body={body} /> },

    { id: 'rehearsal', title: 'This flight beside the rehearsals', content: rehearsal && done ? <>
      <table className="deb-table">
        <thead><tr><th scope="col">Touchdown</th><th scope="col">This flight</th><th scope="col">{body} terrain, mean</th><th scope="col">Earth analog, mean</th></tr></thead>
        <tbody>{rehearsal.map(r => <tr key={r.label}><th scope="row">{r.label}</th>{[r.flown, r.planetary, r.analog].map((v, i) => <td key={i}>{v.toFixed(r.digits)} {r.unit}</td>)}</tr>)}</tbody>
      </table>
      <p className="deb-note">The rehearsal columns are means of {done.guided.seeds.length} autonomous landings under {body} gravity over each terrain. When the two columns agree, the Earth site is a useful predictor of how this vehicle lands at {target.name}. This flight used the mission settings as flown{mission.strategy.mode === 'MANUAL_CONTROL' ? ', under manual control' : ''}, so differences can come from the conditions as well as the terrain.</p>
    </> : done ? <p className="deb-pending">This flight never touched down, so there is no touchdown to set beside the rehearsal flights.</p> : <Pending fidelity={fidelity} body={body} /> },

    { id: 'outcome', title: 'Landing outcome', content: <>
      <Tiles columns={4} hero items={[
        ['Overall', <><b className="deb-grade">{scores.grade}</b> {scores.overall} / 100</>],
        ['Survivability', outOf100(scores.safety), 'how far inside the touchdown limits'],
        ['Precision', outOf100(scores.precision), a.touchedDown ? (s.distanceFromAimM < 0.5 ? 'reached the aim point' : `${s.distanceFromAimM.toFixed(1)} m from the aim point`) : 'no touchdown'],
        ['Fuel efficiency', outOf100(scores.efficiency), scores.efficiency === null ? 'not scored for this outcome' : 'unbraked arrival speed ÷ delta-v spent'],
      ]} />
      <Tiles items={[
        ['Vertical contact speed', contact(`${result.verticalSpeedMps.toFixed(2)} m/s`)],
        ['Lateral contact speed', contact(`${result.horizontalSpeedMps.toFixed(2)} m/s`)],
        ['Vehicle tilt', `${result.tiltDeg.toFixed(2)}°`],
        ['Ground slope', contact(`${result.slopeDeg.toFixed(2)}°`)],
        ['Fuel remaining', `${result.fuelRemainingKg.toFixed(1)} kg`],
        ['Distance from target', reached(result.distanceFromTargetM)],
      ]} />
      <h4>What happened</h4>
      {result.failureReasons.length ? <ul className="deb-list">{result.failureReasons.map(r => <li key={r}>{r}</li>)}</ul>
        : <p>The simulated touchdown stayed within this vehicle’s speed, slope, tilt and roughness limits.</p>}
      <Findings title="Why the flight ended this way" items={a.causes} />
      <Findings title={a.causes.length ? 'Contributing conditions' : 'Worth noting'} items={a.factors} />
      <Findings title="For the next flight" items={a.recommendations} />
      <p className="deb-note">Overall = {SCORING.weights.safety * 100}% survivability + {SCORING.weights.precision * 100}% precision + {SCORING.weights.efficiency * 100}% fuel efficiency, capped by the outcome. These are game scores for comparing flights in this simulator, not engineering ratings.</p>
    </> },

    { id: 'limits', title: 'Touchdown against limits', content: <>
      <LanderSchematic readings={subsystems} shape={mission.equipment ?? { hazardSensor: mission.strategy.hazardSensor }}>
        {a.margins.length ? <ul className="deb-margins compact">{a.margins.map(m => <li key={m.key} className={m.status}>
          <span>{m.label}</span>
          <div className="deb-track" role="img" aria-label={`${m.label}: ${Math.round(m.ratio * 100)} percent of the limit`}><i style={{ width: `${Math.min(m.ratio, 1) * 100}%` }} /></div>
          <b>{m.value.toFixed(m.unit === '°' ? 1 : 2)} / {m.limit} {m.unit}</b>
          <em>{Math.round(m.ratio * 100)}%{m.status === 'exceeded' ? ' · over' : m.status === 'marginal' ? ' · marginal' : ''}</em>
        </li>)}</ul> : <p>The vehicle never touched down, so there are no contact readings to compare with its limits.</p>}
        {gearRows(flight).length > 0 && <p className="deb-note">Landing gear · {gearRows(flight).map(([name, value]) => `${name}: ${value}`).join(' · ')}</p>}
      </LanderSchematic>
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

    { id: 'surface-ops', title: 'How this analog helps exploration', content: <>
      <p className="deb-lede">After touchdown: how well does {earth.name} rehearse surface work at {target.name}, and can this landing support it?</p>
      <div className="deb-ops">{surface.map(item => <article key={item.id} className={`deb-op ${item.level}`}>
        <header><h4>{item.title}</h4><span>{OPS_LEVEL[item.level]}</span></header>
        {item.applies ? <>
          <p><strong>{target.name}:</strong> {item.target.join(' ')}</p>
          <p><strong>{earth.name}:</strong> {item.analog.join(' ')}</p>
          <p><strong>This landing:</strong> {item.landed.join(' ')}</p>
        </> : <p>{item.target.join(' ')}</p>}
      </article>)}</div>
      <p className="deb-note">From catalog labels, resource indicators and thermal records plus the touchdown state. No drill, rover, regolith-depth or biosignature data is ingested: readiness indicators, not measurements.</p>
    </> },
  ];
}

/* ---- the analogy, dimension by dimension: the challenge's own list of what an analog can share */
export type Fit = 'strong' | 'partial' | 'poor' | 'unknown' | 'na';
const FIT_WORD: Record<Fit, string> = { strong: 'Strong analog', partial: 'Partial analog', poor: 'Weak analog', unknown: 'Not established', na: 'Not applicable' };
export interface AnalogDimension { id: string; name: string; short: string; fit: Fit; evidence: string; source: string }
const FROM_OPS: Record<OpsLevel, Fit> = { supported: 'strong', limited: 'partial', not_established: 'unknown', not_applicable: 'na' };

/** Rates the pair on each dimension from catalog values, the flight and the rehearsals; unknowns stay unknown. */
export function analogDimensions(input: SectionInput): AnalogDimension[] {
  const { flight, mission, match, fidelity, analogEntry, planetaryEntry } = input;
  const target = mission.planetaryTarget, earth = mission.earthAnalog, body = target.body;
  const num = (site: CatalogSite | undefined, key: string) => { const v = (site?.conditions?.[key] as { value?: unknown } | undefined)?.value; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
  const ops = Object.fromEntries(surfaceOpsAssessment(input).map(o => [o.id, o])) as Record<SurfaceOpsItem['id'], SurfaceOpsItem>;
  const done = fidelity.status === 'done' ? fidelity.result : null;
  const dem = body === 'Moon' ? 'LRO LOLA DEM' : 'MGS MOLA DEM';

  // terrain
  const t = match?.terrain_similarity_percent ?? null;
  const tp95 = num(planetaryEntry, 'slope_p95'), ap95 = num(analogEntry, 'slope_p95');
  const terrainFit: Fit = t === null ? 'unknown' : t >= 70 ? 'strong' : t >= 50 ? 'partial' : 'poor';
  // geology
  const relation = match?.landform?.relation ?? 'unknown';
  const sameRock = !!match && match.geology.earth_substrate === match.geology.planetary_substrate;
  const geologyFit: Fit = relation === 'same_family' ? (sameRock ? 'strong' : 'partial') : relation === 'related_family' ? 'partial' : relation === 'different_family' ? 'poor' : 'unknown';
  // temperature
  const tMin = num(planetaryEntry, 'bolometric_temperature_min'), tMax = num(planetaryEntry, 'bolometric_temperature_max'), earthT = num(analogEntry, 'surface_temperature');
  const c = (k: number) => `${(k - 273.15).toFixed(0)} °C`;
  const tempFit: Fit = tMin === null || tMax === null || earthT === null ? 'unknown' : earthT + 273.15 >= tMin && earthT + 273.15 <= tMax ? 'partial' : 'poor';
  // atmosphere and dust
  const wind = num(analogEntry, 'wind_speed_10m');
  // landing operations: do blind landings find landable ground about as often on both terrains?
  const gap = done ? Math.abs(done.stress.planetary.successRate - done.stress.analog.successRate) * 100 : null;
  const opsFit: Fit = gap === null ? 'unknown' : gap <= 10 ? 'strong' : gap <= 25 ? 'partial' : 'poor';

  return [
    { id: 'terrain', name: 'Terrain and topography', short: 'terrain and slopes', fit: terrainFit,
      evidence: `${t === null ? 'No terrain match recorded' : `${t.toFixed(1)}% terrain-shape match (slope, roughness, relief)`}.${tp95 !== null && ap95 !== null ? ` 95% of ground below ${tp95.toFixed(1)}° at ${target.name} vs ${ap95.toFixed(1)}° here.` : ''}`,
      source: `${dem} · Copernicus DEM GLO-30` },
    { id: 'geology', name: 'Geology and surface materials', short: 'landform and geology', fit: geologyFit,
      evidence: match ? `${capital(words(match.geology.earth_morphology))} in ${words(match.geology.earth_substrate)} here; ${words(match.geology.planetary_morphology)} in ${words(match.geology.planetary_substrate)} at ${target.name}.${sameRock ? '' : ' Same shape, different material.'}` : 'No catalog pairing, so landform and material are not compared.',
      source: 'Catalog landform and substrate labels' },
    { id: 'temperature', name: 'Temperature and illumination', short: 'temperature', fit: tempFit,
      evidence: tMin !== null && tMax !== null
        ? `${target.name}: ${c(tMin)} to ${c(tMax)} at the surface. ${earth.name}: ${earthT !== null ? `${earthT.toFixed(0)} °C mean` : 'not recorded'}${tempFit === 'poor' ? ', outside that range' : ''}.`
        : `No surface temperature record for ${target.name} in the catalog${earthT !== null ? `; ${earth.name} averages ${earthT.toFixed(0)} °C` : ''}.`,
      source: body === 'Moon' ? 'LRO Diviner · NASA POWER' : 'NASA POWER (Earth only)' },
    { id: 'water', name: 'Water, ice and resources', short: 'water and ice', fit: FROM_OPS[ops['water-isru'].level],
      evidence: `${target.name}: ${ops['water-isru'].target[0]} ${earth.name}: ${ops['water-isru'].analog[0]}`,
      source: body === 'Moon' ? 'Catalog resource indicators · LRO Diviner' : 'Catalog resource indicators' },
    { id: 'atmosphere', name: 'Dust, wind and atmosphere', short: 'dust and atmosphere', fit: body === 'Moon' ? 'poor' : 'partial',
      evidence: body === 'Moon'
        ? `The Moon is airless: dust moves only when the plume throws it. ${earth.name} has air${wind !== null ? ` and ${wind.toFixed(1)} m/s mean wind` : ''}.`
        : `Wind moves dust at both sites, but Mars has a thin carbon-dioxide atmosphere${wind !== null ? `; ${earth.name} averages ${wind.toFixed(1)} m/s wind in Earth air` : ''}.`,
      source: `NASA Science · NASA POWER` },
    { id: 'biology', name: 'Biology and habitability', short: 'habitability', fit: FROM_OPS[ops.habitability.level],
      evidence: ops.habitability.applies ? `${ops.habitability.target[0]} ${ops.habitability.landed[0]}` : ops.habitability.target[0],
      source: 'Catalog landform and substrate labels' },
    { id: 'subsurface', name: 'Caves and subsurface', short: 'caves and subsurface', fit: FROM_OPS[ops.subsurface.level],
      evidence: `${target.name}: ${ops.subsurface.target[0]} ${earth.name}: ${ops.subsurface.analog[0]}`,
      source: 'Catalog site descriptions' },
    { id: 'operations', name: 'Landing and robotic operations', short: 'landing operations', fit: opsFit,
      evidence: done ? `Blind landings found landable ground ${Math.round(done.stress.planetary.successRate * 100)}% of the time on ${body} terrain and ${Math.round(done.stress.analog.successRate * 100)}% here, with the same lander in ${body} gravity.`
        : fidelity.status === 'working' ? 'Rehearsal flights over both terrains are still running.' : 'No rehearsal comparison is available.',
      source: `Simulated rehearsal flights over both DEMs` },
    { id: 'limits', name: 'Gravity, vacuum and radiation', short: 'gravity, air and radiation', fit: 'poor',
      evidence: `${target.name}: ${target.gravity} m/s² and ${air(body)}, no global magnetic shielding. Earth: 9.81 m/s², dense air and shielding. This flight changed gravity and air in simulation only (${flight.environment.gravity} m/s²).`,
      source: 'Physical constants · NASA Science' },
  ];
}

export type OpsLevel = 'supported' | 'limited' | 'not_established' | 'not_applicable';
const OPS_LEVEL: Record<OpsLevel, string> = { supported: 'Analog supported', limited: 'Partial analog', not_established: 'Not established', not_applicable: 'Not applicable' };
export interface SurfaceOpsItem { id: 'water-isru' | 'mobility' | 'subsurface' | 'habitability'; title: string; applies: boolean; level: OpsLevel; target: string[]; analog: string[]; landed: string[] }

const AQUEOUS_SUBSTRATE = new Set(['sedimentary_rock', 'evaporite', 'icy_regolith', 'permafrost', 'gypsum_sand']);
const AQUEOUS_LANDFORM = new Set(['delta', 'playa', 'polygonal_ground', 'badlands']);
const SUBSURFACE = /lava[- ]tube|skylight|pit crater|collapse pit|\bpits?\b|cave/i;
const NEGATED = /\b(no|not|without|nor)\b/i;
/** Commonly used temperature below which surface water ice is stable over long periods. */
const ICE_STABLE_K = 110;

/** Section 10 as data: four post-landing dimensions from catalog records and the touchdown state. */
export function surfaceOpsAssessment({ flight, mission, fidelity, analogEntry, planetaryEntry }: SectionInput): SurfaceOpsItem[] {
  const a = debriefFor(flight, mission), summary = flight.summary!, target = mission.planetaryTarget, body = target.body;
  const num = (site: CatalogSite | undefined, key: string) => { const v = (site?.conditions?.[key] as { value?: unknown } | undefined)?.value; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
  const labels = (site?: CatalogSite) => `${words(site?.morphology)}, ${words(site?.substrate)}`;
  const indicators = (site?: CatalogSite) => ((site?.resource_indicators ?? []) as { resource?: string; evidence_status?: string; scope?: string }[])
    .filter(r => r.resource).map(r => `${words(r.resource)} (${words(r.evidence_status)}): ${r.scope ?? ''}`.trim());
  const margin = (key: string) => a.margins.find(m => m.key === key);
  const tilt = margin('tilt'), slope = margin('slope'), rough = margin('roughness');
  const stable = a.touchedDown && [tilt, slope, rough].every(m => m && m.status !== 'exceeded');
  const restState = a.touchedDown
    ? `Resting at ${summary.tiltDeg.toFixed(1)}° tilt (${Math.round((tilt?.ratio ?? 0) * 100)}% of the lander’s limit) on ${summary.slopeDeg.toFixed(1)}° ground with ${summary.roughnessM.toFixed(2)} m roughness under the legs.`
    : 'The vehicle did not touch down, so there is no surface platform.';
  const done = fidelity.status === 'done' ? fidelity.result : null;

  // water, ice and ISRU
  const targetIce = indicators(planetaryEntry), analogIce = indicators(analogEntry);
  const coldMin = num(planetaryEntry, 'bolometric_temperature_min');
  const coldTrap = coldMin !== null ? [`Diviner regional minimum ${coldMin.toFixed(0)} K, ${coldMin < ICE_STABLE_K ? 'below' : 'above'} the ~${ICE_STABLE_K} K level where surface ice stays stable.`] : [];
  const targetWet = targetIce.length > 0 || AQUEOUS_SUBSTRATE.has(String(planetaryEntry?.substrate)) || (coldMin !== null && coldMin < ICE_STABLE_K);
  const analogWet = analogIce.length > 0 || ['permafrost', 'icy_regolith', 'evaporite'].includes(String(analogEntry?.substrate));
  // mobility
  const p95 = (site?: CatalogSite) => num(site, 'slope_p95');
  const tp95 = p95(planetaryEntry), ap95 = p95(analogEntry);
  const slopeGap = tp95 !== null && ap95 !== null ? Math.abs(tp95 - ap95) : null;
  // subsurface
  // Only affirmative sentences count: catalog text often says what a site is NOT ("no cave claim").
  const mentions = (site: CatalogSite | undefined, extra = '') => `${site?.name ?? ''}. ${(site?.description as string | undefined) ?? ''}. ${(site?.identifiers ?? []).join(' ')}. ${extra}`
    .split(/[.;]\s*/).some(sentence => SUBSURFACE.test(sentence) && !NEGATED.test(sentence));
  const targetVoid = mentions(planetaryEntry, target.name), analogVoid = mentions(analogEntry, mission.earthAnalog.name);
  // habitability (Mars only)
  const aqueous = (site?: CatalogSite) => AQUEOUS_SUBSTRATE.has(String(site?.substrate)) || AQUEOUS_LANDFORM.has(String(site?.morphology));

  return [
    { id: 'water-isru', title: 'Water, ice and ISRU', applies: true,
      level: targetWet && analogWet ? 'supported' : targetWet || analogWet ? 'limited' : 'not_established',
      target: [...(targetIce.length ? targetIce : ['No water or ice indicator recorded for this study area.']), ...coldTrap, `Catalog labels: ${labels(planetaryEntry)}.`],
      analog: [...(analogIce.length ? analogIce : ['No water or ice indicator recorded.']), `Catalog labels: ${labels(analogEntry)}.`],
      landed: [restState, stable ? 'Within every attitude and contact limit, so a level platform for drilling or sampling is plausible; no drill is modelled.' : 'Outside a limit or not landed: no stable platform for drilling or sampling.'] },
    { id: 'mobility', title: 'Surface mobility and robotic operations', applies: true,
      level: !a.touchedDown ? 'not_established' : slopeGap !== null && slopeGap <= 5 ? 'supported' : 'limited',
      target: [tp95 !== null ? `95% of the study area is below ${tp95.toFixed(1)}° slope (on a ${body === 'Moon' ? 150 : 500} m grid, which smooths small obstacles).` : 'Slope distribution not recorded.',
        done ? `${Math.round(done.stress.planetary.successRate * 100)}% of blind landings found landable ground.` : ''].filter(Boolean),
      analog: [ap95 !== null ? `95% of the study area is below ${ap95.toFixed(1)}° slope (30 m grid).` : 'Slope distribution not recorded.',
        slopeGap !== null ? `The traverse slopes differ by ${slopeGap.toFixed(1)}°${slopeGap > 5 ? ', so the analog misrepresents traverse hazards' : ''}.` : '',
        done ? `${Math.round(done.stress.analog.successRate * 100)}% of blind landings found landable ground.` : ''].filter(Boolean),
      landed: [restState, 'No rover or egress ramp is modelled; judged against the lander’s own slope, tilt and roughness limits.'] },
    { id: 'subsurface', title: 'Subsurface access and base construction', applies: true,
      level: targetVoid && analogVoid ? 'supported' : targetVoid || analogVoid ? 'limited' : 'not_established',
      target: [targetVoid ? 'The catalog record describes pits, skylights or lava-tube context at this site.' : 'No pit, cave or lava-tube context in the catalog record.', `Surface material: ${words(planetaryEntry?.substrate)}; regolith depth for shielding or sintering is not recorded.`],
      analog: [analogVoid ? 'The catalog record describes pits, caves or lava-tube context.' : 'No pit, cave or lava-tube context in the catalog record.', `Surface material: ${words(analogEntry?.substrate)}.`],
      landed: [a.touchedDown ? `Landed ${summary.distanceFromTargetM < 0.5 ? 'on' : `${summary.distanceFromTargetM.toFixed(0)} m from`} the aim point; ${summary.diverted ? 'guidance diverted around a hazard.' : 'no divert.'}` : 'No touchdown.'] },
    body === 'Mars'
      ? { id: 'habitability', title: 'Biology and habitability', applies: true,
          level: aqueous(planetaryEntry) && aqueous(analogEntry) ? 'limited' : 'not_established',
          target: [`Catalog labels: ${labels(planetaryEntry)}.${aqueous(planetaryEntry) ? ' These record a water-related setting, the context in which Mars biosignatures are sought.' : ''}`],
          analog: [`Catalog labels: ${labels(analogEntry)}.${aqueous(analogEntry) ? ' A water-related or extreme environment of the kind where extremophiles are studied.' : ''}`],
          landed: ['No biosignature, organic or microbial data is ingested; this is a setting comparison only.'] }
      : { id: 'habitability', title: 'Biology and habitability', applies: false, level: 'not_applicable',
          target: ['Not assessed for lunar targets: the Moon has no known habitable environment.'], analog: [], landed: [] },
  ];
}

/** The report as data, for the download button. Same sources as the pages; no values of its own. */
export function buildReportExport(input: SectionInput) {
  const { flight, mission, profile, match, evidence, fidelity, analogEntry, planetaryEntry } = input;
  const a = debriefFor(flight, mission), env = flight.environment, summary = flight.summary!;
  const done = fidelity.status === 'done' ? fidelity.result : null;
  const target = mission.planetaryTarget, body = target.body;
  return {
    schemaVersion: '2.0.0',
    kind: 'analog-atlas-debrief',
    notice: 'Simulated outcome and engineering similarity scores; not scientifically validated and not a landing-safety assessment.',
    pair: {
      planetaryTarget: { id: target.id, name: target.name, body, gravityMs2: target.gravity },
      earthAnalog: { id: mission.earthAnalog.id, name: mission.earthAnalog.name },
    },
    whyThisAnalog: {
      analogScorePercent: match?.analog_score_percent ?? null,
      landform: match?.landform ?? null,
      terrainSimilarityPercent: match?.terrain_similarity_percent ?? null,
      terrainRangePercent: match?.verification.terrain_range_percent ?? null,
      candidateRank: match?.candidate_rank ?? null,
      evidenceStatus: match?.evidence_status ?? null,
      matches: evidence?.matches ?? [],
      source: evidence?.source ?? null,
    },
    whereItBreaksDown: {
      pairDifferences: evidence?.differences ?? [],
      earthCannotReproduce: {
        gravity: { targetMs2: target.gravity, earthMs2: 9.81, flownMs2: mission.environment.gravityMs2 },
        atmosphere: { target: air(body), flownAirDensityKgM3: env.airDensity },
        radiation: 'not simulated',
        surfaceMaterials: 'regolith mechanics and chemistry are not modelled',
      },
      dataLimits: { earthGridSpacingM: profile.sampleSpacingM, planetaryGridSpacingM: body === 'Moon' ? 150 : 500, rocksGenerated: env.rocksGenerated, rockAbundance: env.rockAbundance },
    },
    terrainAndGeology: { earthStatistics: profile.manifest.statistics ?? null, geology: match?.geology ?? null,
      // the original elevation files the two grids were cut from, for anyone reproducing the comparison
      elevationSources: { earth: profile.manifest.source ?? null, target: input.targetProfile?.manifest.source ?? null } },
    environment: {
      flown: { gravityMs2: env.gravity, airDensityKgM3: env.airDensity, wind: env.wind, interference: env.interference, sources: env.sources },
      comparison: { environmentSimilarityPercent: match?.environment_similarity_percent ?? null, totalSimilarityPercent: match?.total_similarity_percent ?? null,
        features: match?.environment_features ?? [], atmosphere: match?.atmosphere ?? null },
    },
    landingBehaviour: done ? { guided: done.guided, stress: done.stress, rehearsal: rehearsalRows(flight, done.guided) } : { status: fidelity.status },
    flight: {
      mission: { mode: mission.environment.mode, strategy: mission.strategy, equipment: mission.equipment ?? null },
      outcome: summary.outcome, failureReasons: summary.failureReasons, touchdown: summary,
      scores: a.scores, margins: a.margins, statistics: a.stats,
      causes: a.causes, factors: a.factors, recommendations: a.recommendations,
    },
    subsystems: subsystemReadings({ flight, mission, assessment: a, fidelity: done, rehearsal: done ? rehearsalRows(flight, done.guided) : null, analogEntry, planetaryEntry }),
    surfaceOperations: surfaceOpsAssessment(input),
    analogyByDimension: analogDimensions(input),
  };
}

/** Carousel step that wraps round both ends. */
export const stepIndex = (index: number, delta: number, count: number) => ((index + delta) % count + count) % count;
