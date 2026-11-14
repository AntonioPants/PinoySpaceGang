import { useEffect, useState } from 'react';
import type { FlightTelemetry } from '../../../app/sim/src/types';
import type { FidelityResult } from '../../../app/sim/src/fidelity';
import type { MissionConfig, TerrainProfile } from '../lib/types';
import { downloadJson } from '../lib/importSettings';
import { computeFidelity } from '../lib/fidelity';
type FidelityState = { status: 'working' } | { status: 'done'; result: FidelityResult } | { status: 'unavailable'; reason: string };
export default function FlightReport({flight,mission,profile,onRetry}:{flight:FlightTelemetry;mission:MissionConfig;profile:TerrainProfile;onRetry:()=>void}) {
  const result=flight.summary!;
  const env=flight.environment;
  const [fidelity,setFidelity]=useState<FidelityState>({status:'working'});
  useEffect(()=>{
    const abort=new AbortController(); setFidelity({status:'working'});
    computeFidelity(mission,profile,abort.signal)
      .then(r=>{ if(!abort.signal.aborted) setFidelity({status:'done',result:r}); })
      .catch(e=>{ if(!abort.signal.aborted) setFidelity({status:'unavailable',reason:e instanceof Error?e.message:'Could not compute the score.'}); });
    return ()=>abort.abort();
  },[mission,profile]);
  const sources=Object.entries(env.sources);
  return <section className="report-panel"><div className="section-heading"><div><span className="badge ready">Simulation result · {result.outcome}</span><h2>{result.outcome==='success'?'Touchdown complete.':'Flight ended.'}</h2></div><button className="primary-button" onClick={onRetry}>Configure another flight</button></div><p>{mission.planetaryTarget.name} scenario on {mission.earthAnalog.name}. This is a simulated outcome, not an engineering certification.</p>
    <div className="report-metrics">{[['Vertical contact speed',`${result.verticalSpeedMps.toFixed(2)} m/s`],['Lateral contact speed',`${result.horizontalSpeedMps.toFixed(2)} m/s`],['Ground slope',`${result.slopeDeg.toFixed(2)}°`],['Vehicle tilt',`${result.tiltDeg.toFixed(2)}°`],['Fuel remaining',`${result.fuelRemainingKg.toFixed(1)} kg`],['Distance from target',`${result.distanceFromTargetM.toFixed(1)} m`]].map(([name,value])=><div key={name}><span>{name}</span><strong>{result.outcome==='timeout' && /contact|slope/.test(name)?'No touchdown':value}</strong></div>)}</div>
    <h3>What happened</h3>{result.failureReasons.length?<ul>{result.failureReasons.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p>The simulated touchdown stayed within this vehicle’s speed, slope, tilt, and roughness limits.</p>}

    <h3>Analog fidelity</h3>
    {fidelity.status==='working' && <p role="status">Flying the same vehicle on {mission.planetaryTarget.name}’s own terrain to compare…</p>}
    {fidelity.status==='unavailable' && <div className="note warning"><p>No fidelity score: {fidelity.reason}</p></div>}
    {fidelity.status==='done' && <>
      <div className="report-metrics">
        <div><span>Flight fidelity score</span><strong>{fidelity.result.score} / 100</strong></div>
        <div><span>Catalog terrain similarity</span><strong>{typeof fidelity.result.catalogTerrainScore==='number'?`${fidelity.result.catalogTerrainScore.toFixed(2)} of 1`:'No pairing proposed'}</strong></div>
        <div><span>Outcomes ({mission.planetaryTarget.body} / Earth analog)</span><strong>{summarise(fidelity.result.planetary.outcomes)} / {summarise(fidelity.result.analog.outcomes)}</strong></div>
        {([['Same outcome',fidelity.result.components.outcome],['Touchdown speeds',fidelity.result.components.touchdown],['Ground slope & roughness',fidelity.result.components.ground],['Fuel used',fidelity.result.components.fuel]] as const).map(([name,value])=><div key={name}><span>{name}</span><strong>{Math.round(value*100)}%</strong></div>)}
      </div>
      <div className="note"><p>How this is scored: the configured vehicle is flown autonomously over both terrains under {mission.planetaryTarget.body} gravity ({fidelity.result.gravity} m/s²) for {fidelity.result.seeds.length} seeded runs each. {fidelity.result.method} It compares simulated flights over two elevation grids; it is not a geological or soil-mechanics comparison, and the planetary grid is far coarser than the Earth grid.{mission.strategy.mode==='MANUAL_CONTROL'?' Your manual flight is not part of the comparison.':''}</p></div>
    </>}

    <h3>Site conditions used</h3>
    <div className="report-metrics">
      <div><span>Gravity</span><strong>{env.gravity} m/s²</strong></div>
      <div><span>Air density</span><strong>{Number(env.airDensity.toFixed(3))} kg/m³</strong></div>
      <div><span>Wind ({mission.environment.realWeather?'real modelled hour':'scenario setting'})</span><strong>{Math.hypot(env.wind.x,env.wind.y).toFixed(1)} m/s</strong></div>
      <div><span>Dust interference ({mission.environment.interferenceSource==='site'?'from site data':'manual'})</span><strong>{Math.round(env.interference.dust*100)}%</strong></div>
      <div><span>Glare interference ({mission.environment.interferenceSource==='site'?'from site data':'manual'})</span><strong>{Math.round(env.interference.glare*100)}%</strong></div>
      <div><span>Hazard sensor</span><strong>{mission.strategy.hazardSensor==='none'?'None':mission.strategy.hazardSensor}</strong></div>
    </div>
    {sources.length>0 && <ul>{sources.map(([key,value])=><li key={key}>{({soilType:'Surface material',albedo:'Albedo',sunElevationDeg:'Sun elevation',wind_speed_10m:'Wind speed',wind:'Wind',airDensity:'Air density',rock_abundance:'Rock abundance'} as Record<string,string>)[key]??key}: {value}</li>)}</ul>}
    <div className="note"><p>{env.rocksGenerated>0?`${env.rocksGenerated} boulders were generated from a rock abundance of ${(env.rockAbundance*100).toFixed(1)}%.`:'No rock-abundance data exists for this site, so the terrain has no boulders.'} The {profile.sampleSpacingM} m grid cannot establish footpad-scale landing safety. {result.diverted?'Guidance diverted from the initial target.':'No hazard-avoidance diversion was recorded.'}</p></div>
    <button className="subtle-button" onClick={()=>downloadJson({schemaVersion:'1.0.0',mission,flight,fidelity:fidelity.status==='done'?fidelity.result:null},`flight-${mission.planetaryTarget.id}.json`)}>Download flight telemetry JSON</button>
  </section>;
}

function summarise(outcomes: string[]) {
  const counts=new Map<string,number>();
  for(const o of outcomes) counts.set(o,(counts.get(o)??0)+1);
  return [...counts].map(([o,n])=>counts.size===1?o:`${n}× ${o}`).join(', ');
}
