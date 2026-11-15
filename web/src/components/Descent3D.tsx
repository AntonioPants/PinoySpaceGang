import { ComparisonToggle, ComparisonLegend, useTerrainComparison } from './TerrainComparison';
import { buildTerrainHologram, disposeHologram } from '../lib/terrainComparison3D';
import { sampleTerrain } from '../lib/terrainComparison';
import { createPlanetaryFlight } from '../lib/planetaryFlight';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlightView, type CamMode, type FlightSetup } from '../../../app/flightlab/view';
import { prepareTerrain } from './cutscene/terrain';
import { createSim } from '../../../app/sim/src/index';
import type { Sim } from '../../../app/sim/src/index';
import type { Observation, SimEvent } from '../../../app/sim/src/index';
import { HAZARD_SENSORS } from '../../../app/sim/src/hazardSensors';
import { OVERLAY_STYLE } from '../../../app/flightlab/sensorOverlay';
import { loadTerrainPack, peekTerrainPack, setSoundOn, simToPack, soundOn, type TerrainPack } from './cutscene';
import { attachSiteScenery } from "../lib/attachSiteScenery";
import { sceneEnv } from '../game/scenes/sceneEnv';
import { toSimInput } from '../lib/simulation';
import type { DescentProps } from './Descent2D';

/**
 * The descent in Furgan's live 3D view (app/flightlab/view.ts). A shared playback advances the physics
 * engine; this view draws its true state: position, tilt, throttle, hazard scan, divert and
 * trail. At touchdown it plays the ending for the real outcome. Only the physics decides it.
 */
export default function Descent3D({ mission, profile, entry, weather, warming = false, visible = true, playback, onReady, onReport, onExit, toolbarExtra, onUnavailable }:
  DescentProps & { warming?: boolean; visible?: boolean; onReady?: (ready: boolean) => void; onUnavailable: (reason: string) => void }) {
  const comparison = useTerrainComparison(mission.planetaryTarget.id);
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<FlightView | null>(null);
  const sim = useRef<Sim | null>(null);
  const callbacks = useRef({onReady, onUnavailable}); callbacks.current = {onReady, onUnavailable};
  const current = useRef({mission, profile, entry, weather}); current.current = {mission, profile, entry, weather};
  const [pack, setPack] = useState<TerrainPack | null>(() => peekTerrainPack(mission.earthAnalog.terrainBaseUrl));
  const [generation, setGeneration] = useState(0);
  const [ready, setReady] = useState(false);
  const [camera, setCamera] = useState<CamMode>('auto'), [muted, setMuted] = useState(() => !soundOn());
  const [error, setError] = useState(''), [showResult,setShowResult] = useState(true);
  const {hud, summary, events, paused, speed} = playback;
  const started = !!playback.sim;
  // what the descent sensors read (noise and dropouts included), shown in the altitude and velocity readouts
  const [reading, setReading] = useState<Observation | null>(null);
  // manual flight: the player's hazard-scan overlay (button or H)
  const [scanOverlay, setScanOverlay] = useState(true), [scanShown, setScanShown] = useState(false);
  const manual = mission.strategy.mode === 'MANUAL_CONTROL';
  const target = mission.earthAnalog.landingTargetM ?? {x:0,y:0};
  const sceneKey = JSON.stringify([mission.earthAnalog, mission.equipment, sceneEnv(mission).env]);
  useEffect(() => {
    const abort = new AbortController(); let scene: FlightView | null = null;
    setReady(false); callbacks.current.onReady?.(false);
    void (async () => {
      const pack = await loadTerrainPack(mission.earthAnalog.terrainBaseUrl, abort.signal);
      if (pack.manifest.id !== mission.earthAnalog.id) throw new Error('The 3D terrain does not match the selected site');
      await prepareTerrain(pack, simToPack(pack,target), 7, abort.signal);
      if (abort.signal.aborted || !box.current) return;
      setPack(pack);
      scene = new FlightView(box.current, sceneEnv(mission).env, {terrain:pack, landing:simToPack(pack,target), letterbox:false, showSkip:false, muted:true, equipment:mission.equipment});
      scene.externallyDriven = true; scene.paused=true;
      const flight = createSim(toSimInput(mission,profile,entry,weather));
      scene.showIdle(setupFor(flight,target,mission.strategy.mode==='MANUAL_CONTROL'), {x:target.x-400,y:target.y,z:1000});
      view.current = scene;
      await attachSiteScenery(scene, box.current, pack, target, mission.earthAnalog.verticalOffsetM, abort.signal);
      await scene.prepareView(abort.signal);
      if (abort.signal.aborted) return;
      setReady(true); setGeneration(g=>g+1);
    })().catch(e => { if (!abort.signal.aborted) callbacks.current.onUnavailable(e instanceof Error ? e.message : 'the 3D scene could not start'); });
    return () => { abort.abort(); scene?.dispose(); view.current = null; sim.current = null; };
    // Settings that do not change the landscape are applied at launch, without rebuilding it.
  }, [sceneKey, profile]);

  useLayoutEffect(() => {
    const scene=view.current, flight=playback.sim;
    if (!scene || !ready || !flight || sim.current===flight) return;
    sim.current=flight; setError(''); setShowResult(true);
    scene.fly(flight,setupFor(flight,target,mission.strategy.mode==='MANUAL_CONTROL'));
    setGeneration(g=>g+1);
  }, [ready, playback.sim]);
  useEffect(() => {
    const scene=view.current;
    if (!scene || !pack || !ready) return;
    if(!comparison.pack){if(!comparison.enabled||comparison.error)callbacks.current.onReady?.(true);return;}
    const hologram=buildTerrainHologram(pack,comparison.pack,{target,elevation:sampleTerrain(pack,target.x,target.y)!});
    scene.addComparisonSurface(hologram);
    try { scene.setComparisonFlight(createPlanetaryFlight({...toSimInput(mission,profile,entry,weather),strategy:'autonomous'},comparison.pack,pack,mission.planetaryTarget.body==='Moon'?'moon':'mars'),mission.equipment); }
    catch { scene.setComparisonFlight(null); }
    let active=true;
    void scene.prepareView().then(()=>{if(active)callbacks.current.onReady?.(true);}).catch(e=>{if(active)callbacks.current.onUnavailable(e instanceof Error?e.message:'the comparison could not be prepared');});
    return () => { active=false; scene.setComparisonFlight(null); disposeHologram(hologram); };
  }, [comparison.pack, comparison.enabled, comparison.error, pack, generation, ready]);
  useLayoutEffect(() => { view.current?.setMuted(warming || !visible || muted); }, [warming, visible, muted, generation]);
  useLayoutEffect(() => { if(view.current) {view.current.paused=warming||paused; view.current.speed=speed; view.current.camMode=camera; view.current.setActive(warming ? !ready : visible);} }, [warming,visible,paused,speed,camera,generation,ready]);
  const launch=useCallback(()=>playback.launch(toSimInput(current.current.mission,current.current.profile,current.current.entry,current.current.weather)),[playback.launch]);
  const setPaused=playback.setPaused;
  const setSpeed=playback.setSpeed;
  useEffect(()=>playback.onFrame(flight=>{
    const boundX=(profile.manifest.grid.columns-1)*profile.sampleSpacingM/2, boundY=(profile.manifest.grid.rows-1)*profile.sampleSpacingM/2;
    if(!flight.state.done&&(Math.abs(flight.state.position.x)>boundX||Math.abs(flight.state.position.y)>boundY)) {
      setPaused(true); setError('Flight left the measured terrain patch. This run is stopped; restart or change the configuration.');
    }
  }),[playback.onFrame,setPaused,profile]);
  useEffect(() => { if (view.current) view.current.scanOverlay = scanOverlay; }, [scanOverlay, generation]);
  // the HUD's own sensor reading: its own random stream, so reading it never changes the flight;
  // once the flight is over the true values stand, rather than sensor noise on a lander at rest
  useEffect(() => {
    if (!started || warming) return;
    const timer = setInterval(() => {
      const flight = playback.sim; if (!flight) return;
      setReading(flight.state.done ? null : flight.observe()); setScanShown(view.current?.scanStatus.shown ?? false);
    }, 100);
    return () => clearInterval(timer);
  }, [started, warming, playback.sim]);
  // H shows or hides the scan overlay in manual flight (the flight keys themselves live in useLanderSim)
  useEffect(() => {
    if (!manual || warming || !visible) return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyH' && !e.repeat) setScanOverlay(on => !on);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [manual, warming, visible]);

  // ---- the flying sensor, as the HUD reports it
  const sensorId = mission.strategy.hazardSensor;
  const sensorProfile = HAZARD_SENSORS[sensorId] ?? HAZARD_SENSORS.lidar, sensorStyle = OVERLAY_STYLE[sensorId] ?? 'dots';
  const canToggleScan = manual && sensorProfile.map && sensorStyle !== 'none';
  const flightEvents = events as SimEvent[];
  const site = [...flightEvents].reverse().find((e): e is Extract<SimEvent, { type: 'siteSelected' }> => e.type === 'siteSelected');
  const divertM = flightEvents.find((e): e is Extract<SimEvent, { type: 'divert' }> => e.type === 'divert')?.distanceM;
  const blinded = !!reading && (!reading.altimeterValid || !reading.velocimeterValid);
  const quality = playback.sim?.sensor.quality;
  const measuring = `speed ±${sensorProfile.velocitySigmaMps} m/s${blinded ? ' · dust: holding last reading' : ''}`
    // glare: how well the map sees, from the sim (camera-type sensors lose it first)
    + (sensorProfile.map && quality !== undefined && sensorProfile.glareNoiseM >= 0.5 && quality < 0.8
      ? ` · glare degrading the hazard map: ${Math.round(quality * 100)}% quality` : '');
  const sensorLine = !sensorProfile.map
    ? `${measuring} · no hazard map`
    : !manual
      ? (site ? (site.diverted ? `diverted ${divertM?.toFixed(0) ?? ''} m to a safe spot` : site.safe ? 'target clear: landing spot confirmed' : 'no safe spot in range: holding target')
        : `${sensorId === 'crew-window' ? 'crew picks the spot' : 'hazard scan'} at ${sensorProfile.scanAltitudeM} m, ${sensorProfile.divertRadiusM} m range`) + ` · ${measuring}`
      : (sensorStyle === 'none' ? 'by eye: no overlay' : !scanOverlay ? 'scan overlay off (H)' : scanShown ? 'scan overlay on (H): fly to the clear ground' : `scan overlay from ${sensorProfile.scanAltitudeM} m (H)`) + ` · ${measuring}`;
  return <section className="flight-workspace" data-render-ready={ready} data-terrain-id={pack?.manifest.id}><div className="flight-toolbar"><div><strong>{mission.planetaryTarget.name} descent</strong><small>{mission.earthAnalog.name} · Measured Earth terrain · live 3D</small></div><div>
      <button className="subtle-button" onClick={onExit}>{started && !summary ? 'End flight & configure' : 'Back to configuration'}</button>
      <button className="primary-button" disabled={!pack} onClick={launch}>{started ? 'Restart flight' : 'Start descent'}</button>
      {started && !summary && !error && <button className="subtle-button" onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>}
      <label>Playback <select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
      <label>Camera <select aria-label="Camera" value={camera} onChange={e => setCamera(e.target.value as CamMode)}><option value="auto">Auto</option><option value="chase">Chase</option><option value="orbit">Orbit</option><option value="ground">Ground</option><option value="top">Top</option></select></label>
      <button className="subtle-button" aria-pressed={!muted} onClick={() => setMuted(m => { setSoundOn(m); return !m; })}>{muted ? 'Sound on' : 'Sound off'}</button>
      {canToggleScan && <button className="subtle-button" aria-pressed={scanOverlay} title="Show what the hazard sensor maps below its scan height (H)" onClick={() => setScanOverlay(on => !on)}>{scanOverlay ? 'Hide scan overlay' : 'Show scan overlay'}</button>}
      <ComparisonToggle comparison={comparison}/>{toolbarExtra}
    </div></div>
    <div className="flight-stage flight-stage-3d"><div ref={box} className="flight-3d" /><ComparisonLegend comparison={comparison} targetName={mission.planetaryTarget.name} earthName={mission.earthAnalog.name} earthSpacing={profile.sampleSpacingM}/>
      {!started && <div className="launch-overlay"><h2>{pack ? 'Ready for descent' : 'Loading terrain…'}</h2><p>Start 1,000 m above ground, 400 m west of the target.<br />Initial velocity: 25 m/s east and 20 m/s down.</p>{pack && <button className="primary-button" onClick={launch}>Start descent</button>}</div>}
    </div>
    {error && <p role="alert" className="import-error">{error}</p>}
    {/* Altitude and vertical velocity are what the descent sensors read: noise, and held values when dust blinds them. */}
    <div className="flight-hud">{([['Elapsed', `${(hud?.t ?? 0).toFixed(1)} s`, true], ['Altitude AGL', `${(reading?.altitudeAGL ?? hud?.altitudeAGL ?? 1000).toFixed(1)} m`, reading?.altimeterValid ?? true], ['Vertical velocity', `${(reading?.velocity.z ?? hud?.velocity.z ?? -20).toFixed(2)} m/s`, reading?.velocimeterValid ?? true], ['Fuel', `${(hud?.fuelKg ?? mission.strategy.fuelMassKg).toFixed(1)} kg`, true], ['Throttle', `${((hud?.throttle ?? 0) * 100).toFixed(0)}%`, true]] as const).map(([label, value, valid]) => <div key={label} className={valid ? undefined : 'sensor-hold'}><span>{label}{valid ? '' : ' · hold'}</span><strong>{value}</strong></div>)}</div>
    <p className="sensor-status" role="status"><b>{sensorProfile.name}</b> · {sensorLine}</p>
    <p className="flight-help">{manual ? `Keyboard: hold W/S to raise/lower throttle; arrow keys steer; X cuts the engine${canToggleScan ? '; H shows or hides the hazard-scan overlay' : ''}.` : 'Autonomous hazard-avoidance guidance is active after launch.'} The cyan shuttle is a separate autonomous planetary simulation. Physics runs at a fixed 1/120 s timestep. Terrain does not resolve footpad-scale hazards; surface colours, small rocks and fine relief in the 3D view are illustrative.</p>
    {summary && !error && (showResult ? <div className="flight-result" role="status"><div><h2>{summary.outcome === 'success' ? 'Touchdown complete' : `Flight ended: ${summary.outcome}`}</h2><p>{summary.failureReasons.join(' · ') || 'Landing stayed within the configured model limits.'}</p></div><button className="subtle-button" onClick={()=>setShowResult(false)}>Watch comparison</button><button className="primary-button" onClick={() => { if (playback.sim) onReport(playback.sim.telemetry()); }}>View flight report</button></div> : <button className="comparison-result-button subtle-button" onClick={()=>setShowResult(true)}>Show flight result</button>)}
    <details className="model-assumptions"><summary>Model assumptions & recent events</summary><p>Selected modelled weather supplies wind and air density when enabled; otherwise the model uses Earth 1.225 kg/m³, Mars 0.02, or lunar vacuum. Engine defaults: 311 s Isp, drag coefficient 1.2, reference area 15 m², leg radius 2.5 m and a velocimeter. Hazard sensor: {mission.strategy.hazardSensor}. These are simulation assumptions, not measured site conditions. The 3D scene shows the Earth site with Earth sky even under Moon or Mars gravity; camera and vehicle appearance are illustrative.</p><ul>{events.slice(-8).map((e, i) => <li key={i}>{e.t.toFixed(1)} s — {e.type}</li>)}</ul></details>
  </section>;
}

function setupFor(flight: Sim, target: {x:number;y:number}, manual: boolean): FlightSetup {
  const conditions=flight.telemetry().environment, sensor=flight.sensor.profile;
  // the sensor actually flying: whether the autopilot maps the ground, from what height, how far
  return {target,refElevation:flight.terrain.baseHeightAt(target.x,target.y),gravity:flight.gravity,airDensity:flight.airDensity,
    wind:conditions.wind,dust:conditions.interference.dust,hazardScan:!manual&&sensor.map,manual,
    scanAltitudeM:sensor.scanAltitudeM,divertRadiusM:sensor.divertRadiusM,legRadiusM:flight.lander.legRadiusM,maxSlopeDeg:flight.lander.limits.maxSlopeDeg,maxRoughnessM:flight.lander.limits.maxRoughnessM};
}
