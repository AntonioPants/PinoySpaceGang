/**
 * Trial restyle of the flight report after docs/DESIGN_FRAMEWORK.md (1976 NASA Graphics
 * Standards Manual style). Same data as FlightReport.tsx; only the presentation differs.
 * It covers the viewport as its own white sheet so the look can be judged on its own.
 */
import { useEffect, useState } from 'react';
import type { FlightTelemetry, SimEvent } from '../../../app/sim/src/types';
import type { CatalogSite } from '../../../app/sim/src/catalog';
import type { MissionConfig, TerrainProfile } from '../lib/types';
import { downloadJson } from '../lib/importSettings';
import { computeFidelity, type FidelityReport } from '../lib/fidelity';
import './nhb.css';

interface Props { flight: FlightTelemetry; mission: MissionConfig; profile: TerrainProfile; analogEntry?: CatalogSite; planetaryEntry?: CatalogSite; onRetry: () => void; onStandardView: () => void }
type FidelityState = { status: 'working' } | { status: 'done'; result: FidelityReport } | { status: 'unavailable'; reason: string };

const OUTCOME_TITLE: Record<string, string> = { crash: 'Crash', 'tip-over': 'Tip-over', 'hard-landing': 'Hard landing', timeout: 'No touchdown' };

export default function FlightReportNHB({ flight, mission, profile, analogEntry, planetaryEntry, onRetry, onStandardView }: Props) {
  const result = flight.summary!;
  const env = flight.environment;
  const limits = flight.lander.limits;
  const ok = result.outcome === 'success';
  const [fidelity, setFidelity] = useState<FidelityState>({ status: 'working' });
  const [certificate, setCertificate] = useState(false);
  useEffect(() => {
    const abort = new AbortController(); setFidelity({ status: 'working' });
    computeFidelity(mission, profile, analogEntry, planetaryEntry, abort.signal)
      .then(r => { if (!abort.signal.aborted) setFidelity({ status: 'done', result: r }); })
      .catch(e => { if (!abort.signal.aborted) setFidelity({ status: 'unavailable', reason: e instanceof Error ? e.message : 'Could not compute the score.' }); });
    return () => abort.abort();
  }, [mission, profile, analogEntry, planetaryEntry]);
  useEffect(() => { document.getElementById('nhb-title')?.focus({ preventScroll: true }); }, []);

  const body = mission.planetaryTarget.body;
  const site = mission.environment.interferenceSource === 'site';
  const readings: Array<{ label: string; value: string; limit?: string; over?: boolean }> = [
    { label: 'Sink rate', value: `${result.verticalSpeedMps.toFixed(2)} m/s`, limit: `${limits.maxVerticalMps} m/s`, over: result.verticalSpeedMps > limits.maxVerticalMps },
    { label: 'Lateral speed', value: `${result.horizontalSpeedMps.toFixed(2)} m/s`, limit: `${limits.maxHorizontalMps} m/s`, over: result.horizontalSpeedMps > limits.maxHorizontalMps },
    { label: 'Ground slope', value: `${result.slopeDeg.toFixed(1)}°`, limit: `${limits.maxSlopeDeg}°`, over: result.slopeDeg > limits.maxSlopeDeg },
    { label: 'Vehicle tilt', value: `${result.tiltDeg.toFixed(1)}°`, limit: `${limits.maxTiltDeg}°`, over: result.tiltDeg > limits.maxTiltDeg },
    { label: 'Fuel remaining', value: `${result.fuelRemainingKg.toFixed(0)} kg` },
    { label: 'Distance from target', value: `${result.distanceFromTargetM.toFixed(1)} m` },
  ];
  const conditions: Array<{ label: string; value: string; status: string; source: string }> = [
    { label: 'Gravity', value: `${env.gravity} m/s²`, status: 'Modeled', source: 'Scenario constant' },
    { label: 'Air density', value: `${Number(env.airDensity.toFixed(3))} kg/m³`, status: 'Modeled', source: mission.environment.realWeather ? 'NASA POWER' : 'Scenario constant' },
    { label: 'Wind', value: `${Math.hypot(env.wind.x, env.wind.y).toFixed(1)} m/s`, status: mission.environment.realWeather ? 'Modeled' : 'Assumed', source: mission.environment.realWeather ? 'NASA POWER' : 'User' },
    { label: 'Dust interference', value: `${Math.round(env.interference.dust * 100)}%`, status: site ? 'Derived' : 'Assumed', source: site ? 'Catalog substrate' : 'User' },
    { label: 'Glare interference', value: `${Math.round(env.interference.glare * 100)}%`, status: site ? 'Derived' : 'Assumed', source: site ? 'Catalog albedo, latitude' : 'User' },
    { label: 'Rock abundance', value: env.rocksGenerated > 0 ? `${(env.rockAbundance * 100).toFixed(1)}%` : 'None', status: env.rocksGenerated > 0 ? 'Assumed' : 'Unknown', source: env.rocksGenerated > 0 ? 'User' : 'No site data' },
  ];

  return <div className="nhb" role="region" aria-label="Flight report, 1976 manual style trial">
    <header className="nhb-masthead">
      <div className="nhb-white-band">
        <div className="nhb-stem"><span className="nhb-stem-mark">ANALOG</span><span className="nhb-stem-light">Atlas flight report</span></div>
        <div className="nhb-patch-bay" aria-label="Team">
          <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><path d="M22 3 39 13v18L22 41 5 31V13Z" fill="none" stroke="#000" strokeWidth="1.5"/><path d="M22 12v14M15 26h14M17 26l-4 7M27 26l4 7" fill="none" stroke="#000" strokeWidth="1.5"/></svg>
          <span>Pinoy Space Gang<small>Mission 001</small></span>
        </div>
      </div>
      <dl className="nhb-blue-band">
        <div><dt>Target</dt><dd>{mission.planetaryTarget.name}</dd></div>
        <div><dt>Earth analog</dt><dd>{mission.earthAnalog.name}</dd></div>
        <div><dt>Gravity</dt><dd>{env.gravity} m/s²</dd></div>
        <div><dt>Air density</dt><dd>{Number(env.airDensity.toFixed(3))} kg/m³</dd></div>
        <div><dt>Flight time</dt><dd>T+{result.flightTimeS.toFixed(1)} s</dd></div>
        <div className={`nhb-status ${ok ? '' : 'nogo'}`}><dt>Touchdown</dt><dd>{ok ? 'GO' : 'NO-GO'}</dd></div>
      </dl>
    </header>

    <main className="nhb-sheet">
      <div className="nhb-folio"><span>05 Report</span><span>{mission.planetaryTarget.id} / {mission.earthAnalog.id}</span></div>

      <section className="nhb-outcome">
        <div>
          <p className="nhb-parent">{body} scenario over Earth terrain</p>
          <h1 id="nhb-title" tabIndex={-1}>{ok ? 'Touchdown complete' : 'Flight ended'}</h1>
          {ok ? <p className="nhb-lede">The simulated touchdown stayed within this vehicle’s speed, slope, tilt and roughness limits. This is a simulated outcome, not an engineering certification.</p>
            : <div className="nhb-bracket">
                <div className="nhb-patch"><span>{OUTCOME_TITLE[result.outcome] ?? result.outcome}</span></div>
                <div className="nhb-subpatch">{result.failureReasons.length ? result.failureReasons.map(r => <span key={r}>{r}</span>) : <span>No touchdown within the time limit</span>}</div>
              </div>}
        </div>
        <div className="nhb-actions">
          <button className="nhb-button solid" onClick={onRetry}>{ok ? 'Configure another flight' : 'Reconfigure and fly again'}</button>
          <button className="nhb-button" onClick={() => downloadJson({ schemaVersion: '1.0.0', mission, flight, fidelity: fidelity.status === 'done' ? fidelity.result : null }, `flight-${mission.planetaryTarget.id}.json`)}>Download telemetry</button>
          <button className="nhb-button" onClick={onStandardView}>Standard view</button>
        </div>
      </section>

      <div className="nhb-columns">
        <figure className="nhb-diagram">
          <div className="nhb-breathing"><span>Flight profile</span><span>Side view along the approach</span></div>
          <FlightProfile flight={flight} />
        </figure>
        <aside className="nhb-side">
          <h2>Touchdown readings</h2>
          <ul className="nhb-slats">{readings.map(r => <li key={r.label} className={r.over ? 'over' : ''}>
            <span className="nhb-slat-label">{r.label}</span>
            <span className="nhb-slat-value">{result.outcome === 'timeout' && r.limit ? '–' : r.value}</span>
            <span className="nhb-slat-limit">{r.limit ? `limit ${r.limit}` : ''}</span>
            <i className="nhb-dot" aria-label={r.over ? 'over limit' : r.limit ? 'within limit' : undefined} />
          </li>)}</ul>
        </aside>
      </div>

      <section className="nhb-section">
        <h2>Analog fidelity</h2>
        {fidelity.status === 'working' && <p role="status">Flying the same vehicle over {mission.planetaryTarget.name}’s own terrain and over the analog to compare.</p>}
        {fidelity.status === 'unavailable' && <p>No fidelity score: {fidelity.reason}</p>}
        {fidelity.status === 'done' && (({ guided, stress }) => <>
          <div className="nhb-scores">
            <div><span>Stress test, blind landings</span><strong>{stress.score}<small> of 100</small></strong></div>
            <div><span>Guided flight</span><strong>{guided.score}<small> of 100</small></strong></div>
            <div><span>Catalog terrain similarity</span><strong>{typeof guided.catalogTerrainScore === 'number' ? guided.catalogTerrainScore.toFixed(2) : '–'}<small>{typeof guided.catalogTerrainScore === 'number' ? ' of 1' : ' no pairing proposed'}</small></strong></div>
          </div>
          <div className="nhb-bars" role="img" aria-label={`Landable share: ${body} terrain ${Math.round(stress.planetary.successRate * 100)} percent, Earth analog ${Math.round(stress.analog.successRate * 100)} percent`}>
            <p>Share of each terrain where a blind landing succeeds</p>
            {[[`${body} terrain`, stress.planetary.successRate, 'planet'], ['Earth analog', stress.analog.successRate, 'analog']].map(([name, value, cls]) => <div key={name as string} className="nhb-bar-row">
              <span>{name}</span><div className="nhb-bar-track"><i className={cls as string} style={{ width: `${(value as number) * 100}%` }} /></div><b>{Math.round((value as number) * 100)}%</b>
            </div>)}
          </div>
          <div className="nhb-method">
            <p>Both scores fly the configured vehicle autonomously over the planetary target’s own terrain and over the Earth analog, under {body} gravity. The stress test makes {stress.planetary.flights} blind landings, with no hazard sensor, spread over the middle of each terrain, and compares the landable share, the touchdown slope and the fuel used. The guided score compares {guided.seeds.length} hazard-avoiding landings at the centre of each terrain; guidance finds a safe spot on almost any ground, so that score stays high.</p>
            <p>These are comparisons of simulated flights over two elevation grids, not of geology or soil. The planetary grid ({body === 'Moon' ? '150' : '500'} m per sample) is far coarser than the Earth grid ({profile.sampleSpacingM} m), so planetary terrain looks smoother than it is.</p>
          </div>
        </>)(fidelity.result)}
      </section>

      <section className="nhb-section">
        <h2>Site conditions used</h2>
        <table className="nhb-table"><tbody>{conditions.map(c => <tr key={c.label}>
          <th scope="row">{c.label}</th><td className="nhb-num">{c.value}</td>
          <td><span className="nhb-vinylcal"><b className={c.status === 'Assumed' || c.status === 'Unknown' ? 'alert' : ''}>{c.status}</b>{c.source}</span></td>
        </tr>)}</tbody></table>
      </section>

      {ok && <section className="nhb-section">
        <button className="nhb-button" aria-expanded={certificate} onClick={() => setCertificate(v => !v)}>{certificate ? 'Close flight certificate' : 'Open flight certificate'}</button>
        {certificate && <div className="nhb-certificate">
          <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="none" stroke="#000" strokeWidth="1.5"/><circle cx="60" cy="60" r="47" fill="none" stroke="#000" strokeWidth="1"/><path d="M60 30v34M46 64h28M50 64l-9 16M70 64l9 16M36 86h48" fill="none" stroke="#000" strokeWidth="2"/></svg>
          <div><h3>Mission accomplished</h3>
            <p>Be it recorded that a simulated lander, configured by the crew of Pinoy Space Gang, descended over {mission.earthAnalog.name} under the gravity of the {body === 'Moon' ? 'Moon' : 'planet Mars'} and came to rest in {result.flightTimeS.toFixed(1)} seconds, {result.distanceFromTargetM.toFixed(1)} metres from its target, at {result.verticalSpeedMps.toFixed(2)} metres per second.</p>
            <p><em>A simulated flight for the {mission.planetaryTarget.name} study area. Not a certification of landing safety.</em></p></div>
        </div>}
      </section>}
    </main>

    <footer className="nhb-capcom" aria-label="Flight event log">
      <h2>Flight events</h2>
      <ol>{flight.events.filter((e, i) => i === 0 || (e.type !== 'engineOn' && e.type !== 'engineOff')).slice(-10).map((e, i) => <li key={i}><time>T+{e.t.toFixed(1).padStart(5, '0')}</time>{describeEvent(e)}</li>)}</ol>
    </footer>
  </div>;
}

function describeEvent(e: SimEvent): string {
  switch (e.type) {
    case 'engineOn': return 'Engine on';
    case 'engineOff': return 'Engine off';
    case 'dustKickup': return `Dust kick-up at ${e.altitudeM.toFixed(0)} m`;
    case 'hazardDetected': return `Hazard at aim point, slope ${e.slopeDeg.toFixed(1)} deg, roughness ${e.roughnessM.toFixed(2)} m`;
    case 'divert': return `Divert ${e.distanceM.toFixed(1)} m`;
    case 'fuelLow': return `Fuel low, ${e.fuelKg.toFixed(0)} kg`;
    case 'fuelOut': return 'Fuel exhausted';
    case 'touchdown': return `Touchdown, sink ${e.verticalSpeedMps.toFixed(2)} m/s, lateral ${e.horizontalSpeedMps.toFixed(2)} m/s`;
    case 'crash': return `Crash at ${e.impactSpeedMps.toFixed(1)} m/s`;
    case 'tipOver': return `Tip-over on ${e.slopeDeg.toFixed(1)} deg ground`;
    case 'timeout': return 'Time limit reached';
  }
}

/** Boxed technical diagram: ground line and flown path, with ticks in metres on the inner border. */
function FlightProfile({ flight }: { flight: FlightTelemetry }) {
  const s = flight.samples;
  const W = 760, H = 380, L = 58, R = 24, T = 30, B = 46;
  const ground = s.map(p => p.z - p.altitudeAGL);
  // distance flown along the ground track
  const dist: number[] = [0];
  for (let i = 1; i < s.length; i++) dist.push(dist[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
  const xMax = Math.max(dist[dist.length - 1], 1);
  const zLo = Math.min(...ground), zHi = Math.max(...s.map(p => p.z));
  const zMin = zLo - (zHi - zLo) * 0.06, zMax = zHi + (zHi - zLo) * 0.04;
  const X = (d: number) => L + (d / xMax) * (W - L - R);
  const Y = (z: number) => H - B - ((z - zMin) / (zMax - zMin)) * (H - T - B);
  const line = (zs: number[]) => zs.map((z, i) => `${i ? 'L' : 'M'}${X(dist[i]).toFixed(1)},${Y(z).toFixed(1)}`).join(' ');
  const nice = (span: number) => { const p = 10 ** Math.floor(Math.log10(span / 4)); return [1, 2, 5, 10].map(m => m * p).find(m => span / m <= 6)!; };
  const xStep = nice(xMax), zStep = nice(zMax - zMin);
  const xTicks = Array.from({ length: Math.floor(xMax / xStep) + 1 }, (_, i) => i * xStep);
  const zTicks: number[] = []; for (let z = Math.ceil(zMin / zStep) * zStep; z <= zMax; z += zStep) zTicks.push(z);
  const divert = flight.events.find(e => e.type === 'divert');
  const divertIdx = divert ? s.findIndex(p => p.t >= divert.t) : -1;
  const end = s.length - 1;
  const exaggeration = ((H - T - B) / (zMax - zMin)) / ((W - L - R) / xMax);
  const ok = flight.summary?.outcome === 'success';
  return <>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Flight profile: ${xMax.toFixed(0)} metres along the ground, from ${(s[0].altitudeAGL).toFixed(0)} metres above ground to touchdown.`}>
      {xTicks.map(d => <g key={`x${d}`}><line x1={X(d)} x2={X(d)} y1={H - B} y2={H - B - 6} stroke="#000" /><text x={X(d)} y={H - B + 30} textAnchor="middle">{d}</text></g>)}
      {zTicks.map(z => <g key={`z${z}`}><line x1={L} x2={L + 6} y1={Y(z)} y2={Y(z)} stroke="#000" /><text x={L - 8} y={Y(z) + 4} textAnchor="end">{Math.round(z)}</text></g>)}
      <path d={`${line(ground)} L${X(xMax)},${H - B} L${L},${H - B} Z`} fill="#fff" stroke="none" />
      <path d={line(ground)} fill="none" stroke="#000" strokeWidth="1.5" />
      <path d={line(s.map(p => p.z))} fill="none" stroke="#000" strokeWidth="1.5" />
      {divertIdx > 0 && (() => {
        const dx = X(dist[divertIdx]), dy = Y(s[divertIdx].z), j = Math.min(divertIdx + 12, end);
        const left = dx > W - R - 130; // keep the tag inside the frame
        return <g><path d={`M${dx},${dy} L${X(dist[j])},${Y(s[j].z)}`} stroke="#fc3d21" strokeWidth="3" />
          <rect x={left ? dx - 116 : dx + 10} y={dy - 22} width="106" height="18" fill="#fff" stroke="#000" />
          <text x={left ? dx - 110 : dx + 16} y={dy - 9} className="tag">Divert {divert && 'distanceM' in divert ? divert.distanceM.toFixed(1) : ''} m</text></g>;
      })()}
      <rect x={X(dist[end]) - 5} y={Y(s[end].z) - 10} width="10" height="10" fill={ok ? '#000' : '#fc3d21'} />
      <text x={X(dist[end]) + 5} y={Y(s[end].z) + 16} textAnchor="end" className="tag">{ok ? 'Touchdown' : 'Impact'}</text>
      <text x={X(0) + 10} y={Y(s[0].z) - 9} className="tag">Start</text>
    </svg>
    <figcaption>Distance along the ground in metres; elevation in metres. {exaggeration >= 1 ? `Vertical scale exaggerated ${exaggeration.toFixed(1)} times.` : `Vertical scale compressed ${(1 / exaggeration).toFixed(1)} times.`}</figcaption>
  </>;
}
