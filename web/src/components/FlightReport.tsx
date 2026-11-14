import type { FlightTelemetry } from '../../../app/sim/src/types';
import type { MissionConfig } from '../lib/types';
import { downloadJson } from '../lib/importSettings';
export default function FlightReport({flight,mission,onRetry}:{flight:FlightTelemetry;mission:MissionConfig;onRetry:()=>void}) {
  const result=flight.summary!;
  return <section className="report-panel"><div className="section-heading"><div><span className="badge ready">Simulation result · {result.outcome}</span><h2>{result.outcome==='success'?'Touchdown complete.':'Flight ended.'}</h2></div><button className="primary-button" onClick={onRetry}>Configure another flight</button></div><p>{mission.planetaryTarget.name} scenario on {mission.earthAnalog.name}. This is a simulated outcome, not an engineering certification.</p>
    <div className="report-metrics">{[['Vertical contact speed',`${result.verticalSpeedMps.toFixed(2)} m/s`],['Lateral contact speed',`${result.horizontalSpeedMps.toFixed(2)} m/s`],['Ground slope',`${result.slopeDeg.toFixed(2)}°`],['Vehicle tilt',`${result.tiltDeg.toFixed(2)}°`],['Fuel remaining',`${result.fuelRemainingKg.toFixed(1)} kg`],['Distance from target',`${result.distanceFromTargetM.toFixed(1)} m`]].map(([name,value])=><div key={name}><span>{name}</span><strong>{result.outcome==='timeout' && /contact|slope/.test(name)?'No touchdown':value}</strong></div>)}</div>
    <h3>What happened</h3>{result.failureReasons.length?<ul>{result.failureReasons.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p>The simulated touchdown stayed within this vehicle’s speed, slope, tilt, and roughness limits.</p>}
    <div className="note"><p>Analog fidelity remains unvalidated. The 30 m DEM cannot establish boulder or footpad-scale landing safety. {result.diverted?'Guidance diverted from the initial target.':'No hazard-avoidance diversion was recorded.'}</p></div>
    <button className="subtle-button" onClick={()=>downloadJson({schemaVersion:'1.0.0',mission,flight},`flight-${mission.planetaryTarget.id}.json`)}>Download flight telemetry JSON</button>
  </section>;
}
