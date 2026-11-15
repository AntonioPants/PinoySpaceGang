import { useEffect, useState } from 'react';
import type { FlightTelemetry } from '../../../app/sim/src/types';
import type { CatalogSite } from '../../../app/sim/src/catalog';
import type { MissionConfig, TerrainProfile } from '../lib/types';
import { computeFidelity, type FidelityReport } from '../lib/fidelity';
import type { MatchCheck } from '../lib/matching';
import LandingEvidence from './LandingEvidence';
import FlightDebrief from './FlightDebrief';
type FidelityState = { status: 'working' } | { status: 'done'; result: FidelityReport } | { status: 'unavailable'; reason: string };
export default function FlightReport({flight,mission,profile,analogEntry,planetaryEntry,planetaryProfile,match,onRetry}:{planetaryProfile?:TerrainProfile;match?:MatchCheck;flight:FlightTelemetry;mission:MissionConfig;profile:TerrainProfile;analogEntry?:CatalogSite;planetaryEntry?:CatalogSite;onRetry:()=>void}) {
  const result=flight.summary!;
  const env=flight.environment;
  const [fidelity,setFidelity]=useState<FidelityState>({status:'working'});
  useEffect(()=>{
    const abort=new AbortController(); setFidelity({status:'working'});
    computeFidelity(mission,profile,analogEntry,planetaryEntry,abort.signal,planetaryProfile)
      .then(r=>{ if(!abort.signal.aborted) setFidelity({status:'done',result:r}); })
      .catch(e=>{ if(!abort.signal.aborted) setFidelity({status:'unavailable',reason:e instanceof Error?e.message:'Could not compute the score.'}); });
    return ()=>abort.abort();
  },[mission,profile,analogEntry,planetaryEntry, planetaryProfile]);
  const sources=Object.entries(env.sources);
  return <section className="report-panel"><div className="section-heading"><div><span className="badge ready">Simulation result · {result.outcome}</span><h2>{result.outcome==='success'?'Touchdown complete.':'Flight ended.'}</h2></div><button className="primary-button" onClick={onRetry}>Configure another flight</button></div><p>{mission.environment.mode === 'earth' ? 'Earth field test' : `${mission.planetaryTarget.body} physics scenario`} on {mission.earthAnalog.name}, comparing with {mission.planetaryTarget.name}. This is a simulated outcome, not an engineering certification.</p>
    <div className="report-metrics">{[['Vertical contact speed',`${result.verticalSpeedMps.toFixed(2)} m/s`],['Lateral contact speed',`${result.horizontalSpeedMps.toFixed(2)} m/s`],['Ground slope',`${result.slopeDeg.toFixed(2)}°`],['Vehicle tilt',`${result.tiltDeg.toFixed(2)}°`],['Fuel remaining',`${result.fuelRemainingKg.toFixed(1)} kg`],['Distance from target',result.distanceFromTargetM<0.5?'Reached':`${result.distanceFromTargetM.toFixed(1)} m`]].map(([name,value])=><div key={name}><span>{name}</span><strong>{result.outcome==='timeout' && /contact|slope/.test(name)?'No touchdown':value}</strong></div>)}</div>
    <p>What Earth cannot reproduce: target gravity {mission.planetaryTarget.gravity} m/s² versus Earth 9.81 m/s²; target vacuum/thin air versus Earth air. This mission uses {mission.environment.gravityMs2} m/s² and {env.airDensity} kg/m³. Radiation is not simulated or reproduced by the terrain.</p><h3>Catalog baseline landing comparison</h3><LandingEvidence targetId={mission.planetaryTarget.id} earthId={mission.earthAnalog.id}/><h3>What happened</h3>{result.failureReasons.length?<ul>{result.failureReasons.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p>The simulated touchdown stayed within this vehicle’s speed, slope, tilt, and roughness limits.</p>}
    <FlightDebrief flight={flight} mission={mission} fidelity={fidelity.status==='done'?fidelity.result:null} match={match} />

    <h3>Analog fidelity</h3>
    {fidelity.status==='working' && <p role="status">Flying the same vehicle over {mission.planetaryTarget.name}’s own terrain and over the analog to compare…</p>}
    {fidelity.status==='unavailable' && <div className="note warning"><p>No fidelity score: {fidelity.reason}</p></div>}
    {fidelity.status==='done' && (({guided,stress})=><>
      <div className="report-metrics">
        <div><span>Stress test score (blind landings)</span><strong>{stress.score} / 100</strong></div>
        <div><span>Guided flight score</span><strong>{guided.score} / 100</strong></div>
        <div><span>Catalog terrain similarity</span><strong>{typeof guided.catalogTerrainScore==='number'?`${guided.catalogTerrainScore.toFixed(2)} of 1`:'No pairing proposed'}</strong></div>
        <div><span>Landable share · {mission.planetaryTarget.body} terrain</span><strong>{Math.round(stress.planetary.successRate*100)}%</strong></div>
        <div><span>Landable share · Earth analog</span><strong>{Math.round(stress.analog.successRate*100)}%</strong></div>
        <div><span>Mean touchdown slope ({mission.planetaryTarget.body} / analog)</span><strong>{stress.planetary.meanSlopeDeg.toFixed(1)}° / {stress.analog.meanSlopeDeg.toFixed(1)}°</strong></div>
        <div><span>Guided outcome</span><strong>{[...guided.planetary.outcomes,...guided.analog.outcomes].every(o=>o==='success')?'Success':'Failure'}</strong></div>
      </div>
      <div className="note"><p>Both scores fly the configured vehicle autonomously over the planetary target’s own terrain and over the Earth analog, under {mission.planetaryTarget.body} gravity ({guided.gravity} m/s²). <strong>Stress test:</strong> {stress.method} It shows how much of each terrain is landable without hazard avoidance. <strong>Guided:</strong> {guided.seeds.length} hazard-avoiding landings at the centre of each terrain; score = 40% outcome agreement + 25% touchdown speeds + 20% ground slope/roughness + 15% fuel used. Guidance finds a safe spot on almost any terrain, so this score stays high.</p></div>
      <div className="note"><p>These compare simulated flights over two elevation grids; they are not a geological or soil-mechanics comparison. The planetary grid ({mission.planetaryTarget.body==='Moon'?'150':'500'} m per sample) is far coarser than the Earth grid ({profile.sampleSpacingM} m), so planetary terrain looks smoother than it is and a rugged Earth site scores lower partly for that reason.{mission.strategy.mode==='MANUAL_CONTROL'?' Your manual flight is not part of the comparison.':''}</p></div>
    </>)(fidelity.result)}

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
  </section>;
}
