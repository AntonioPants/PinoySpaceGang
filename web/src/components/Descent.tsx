import { useEffect, useRef, useState } from 'react';
import { useLanderSim } from '../../../app/sim/react/useLanderSim';
import { SideView } from '../../../app/sim/viewer/components/SideView';
import type { FlightTelemetry } from '../../../app/sim/src/types';
import type { MissionConfig, TerrainProfile } from '../lib/types';
import { toSimInput } from '../lib/simulation';
export default function Descent({ mission, profile, onReport, onExit }: {mission:MissionConfig;profile:TerrainProfile;onReport:(flight:FlightTelemetry)=>void;onExit:()=>void}) {
  const lander = useLanderSim({speed:1,keyboard:mission.strategy.mode==='MANUAL_CONTROL'});
  const [error,setError]=useState(''), [started,setStarted]=useState(false);
  const outside=useRef(false);
  function launch() { try { outside.current=false; setError(''); lander.launch(toSimInput(mission,profile)); setStarted(true); } catch(e) {setError(e instanceof Error?e.message:'Could not launch.');} }
  useEffect(()=>lander.onFrame(sim=>{
    const boundX=(profile.manifest.grid.columns-1)*profile.sampleSpacingM/2;
    const boundY=(profile.manifest.grid.rows-1)*profile.sampleSpacingM/2;
    if (!outside.current && (Math.abs(sim.state.position.x)>boundX || Math.abs(sim.state.position.y)>boundY)) {
      outside.current=true; lander.setPaused(true); setError('Flight left the measured terrain patch. This run is stopped; restart or change the configuration.');
    }
  }),[lander.onFrame,lander.setPaused,profile]);
  const state=lander.hud;
  return <section className="flight-workspace"><div className="flight-toolbar"><div><strong>{mission.planetaryTarget.name} descent</strong><small>Tim’s physics engine · Kilbourne measured terrain</small></div><div><button className="subtle-button" onClick={onExit}>Back to configuration</button><button className="primary-button" onClick={launch}>{started?'Restart flight':'Start descent'}</button>{started && !lander.summary && !error && <button className="subtle-button" onClick={lander.togglePause}>{lander.paused?'Resume':'Pause'}</button>}<label>Playback <select aria-label="Playback speed" value={lander.speed} onChange={e=>lander.setSpeed(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div></div>
    <div className="flight-stage"><SideView onFrame={lander.onFrame} paused={lander.paused}/>{!started&&<div className="launch-overlay"><h2>Ready for descent</h2><p>Start 1,000 m above ground, 400 m west of the target.<br/>Initial velocity: 25 m/s east and 20 m/s down.</p><button className="primary-button" onClick={launch}>Start descent</button></div>}</div>
    {error && <p role="alert" className="import-error">{error}</p>}
    <div className="flight-hud">{[['Elapsed',`${(state?.t??0).toFixed(1)} s`],['Altitude AGL',`${(state?.altitudeAGL??1000).toFixed(1)} m`],['Vertical velocity',`${(state?.velocity.z??-20).toFixed(2)} m/s`],['Fuel',`${(state?.fuelKg??mission.strategy.fuelMassKg).toFixed(1)} kg`],['Throttle',`${((state?.throttle??0)*100).toFixed(0)}%`]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <p className="flight-help">{mission.strategy.mode==='MANUAL_CONTROL'?'Keyboard: hold W/S to raise/lower throttle; arrow keys steer; X cuts the engine.':'Autonomous hazard-avoidance guidance is active after launch.'} Physics runs at a fixed 1/120 s timestep. Terrain does not resolve footpad-scale hazards.</p>
    {lander.summary && !error && <div className="flight-result" role="status"><div><h2>{lander.summary.outcome==='success'?'Touchdown complete':`Flight ended: ${lander.summary.outcome}`}</h2><p>{lander.summary.failureReasons.join(' · ')||'Landing stayed within the configured model limits.'}</p></div><button className="primary-button" onClick={()=>{if(lander.sim)onReport(lander.sim.telemetry());}}>View flight report</button></div>}
    <details className="model-assumptions"><summary>Model assumptions & recent events</summary><p>Constant near-surface atmosphere (Earth 1.225 kg/m³; Mars 0.02; Moon vacuum). Engine defaults: 311 s Isp, drag coefficient 1.2, reference area 15 m², leg radius 2.5 m, lidar and velocimeter. These are simulation assumptions, not measured site conditions. Camera view and vehicle appearance are illustrative.</p><ul>{lander.events.slice(-8).map((e,i)=><li key={i}>{e.t.toFixed(1)} s — {e.type}</li>)}</ul></details>
  </section>;
}
