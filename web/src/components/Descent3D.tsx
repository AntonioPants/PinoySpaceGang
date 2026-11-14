import { useCallback, useEffect, useRef, useState } from 'react';
import { FlightView, type CamMode, type FlightSetup } from '../../../app/flightlab/view';
import { createManualPilot, createSim, keysToPilotInput } from '../../../app/sim/src/index';
import type { FlightSummary, Sim, SimEvent, SimState } from '../../../app/sim/src/index';
import { loadTerrainPack, peekTerrainPack, simToPack, type TerrainPack } from './cutscene';
import { sceneEnv } from '../game/scenes/sceneEnv';
import { toSimInput } from '../lib/simulation';
import type { DescentProps } from './Descent2D';

/**
 * The descent in Furgan's live 3D view (app/flightlab/view.ts). The view advances the physics
 * engine each frame and draws its true state: position, tilt, throttle, hazard scan, divert and
 * trail. At touchdown it plays the ending for the real outcome. Only the physics decides it.
 */
export default function Descent3D({ mission, profile, entry, weather, autoStart = false, onReport, onExit, toolbarExtra, onUnavailable }:
  DescentProps & { onUnavailable: (reason: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<FlightView | null>(null);
  const sim = useRef<Sim | null>(null);
  const pressed = useRef(new Set<string>());
  // after the opening cutscene the pack is already loaded, so the flight can start on the first frame
  const [pack, setPack] = useState<TerrainPack | null>(() => {
    const p = peekTerrainPack(mission.earthAnalog.terrainBaseUrl);
    return p && p.manifest.id === mission.earthAnalog.id ? p : null;
  });
  const [started, setStarted] = useState(false), [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1), [camera, setCamera] = useState<CamMode>('auto'), [muted, setMuted] = useState(true);
  const [hud, setHud] = useState<SimState | null>(null), [summary, setSummary] = useState<FlightSummary | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]), [error, setError] = useState('');
  const manual = mission.strategy.mode === 'MANUAL_CONTROL';
  const unavailable = useRef(onUnavailable); unavailable.current = onUnavailable;

  // terrain for the 3D scene: the same pack the physics flies on
  useEffect(() => {
    const abort = new AbortController();
    loadTerrainPack(mission.earthAnalog.terrainBaseUrl, abort.signal).then(p => {
      if (abort.signal.aborted) return;
      if (p.manifest.id !== mission.earthAnalog.id) throw new Error('The 3D terrain does not match the selected site');
      setPack(p);
    })
      .catch(() => { if (!abort.signal.aborted) unavailable.current('the terrain could not be loaded for 3D'); });
    return () => abort.abort();
  }, [mission.earthAnalog.terrainBaseUrl, mission.earthAnalog.id]);

  const launch = useCallback(() => {
    if (!pack || !box.current) return;
    try {
      const input = toSimInput(mission, profile, entry, weather);
      const flight = createSim(input);
      const target = input.target ?? { x: 0, y: 0 };
      const conditions = flight.telemetry().environment;
      view.current?.dispose();
      const scene = new FlightView(box.current, sceneEnv(mission).env, { terrain: pack, landing: simToPack(pack, target), letterbox: false, showSkip: false, muted, equipment: mission.equipment });
      scene.speed = speed; scene.camMode = camera;
      const setup: FlightSetup = {
        target, refElevation: flight.terrain.baseHeightAt(target.x, target.y), gravity: flight.gravity, airDensity: flight.airDensity,
        wind: conditions.wind, dust: conditions.interference.dust,
        hazardScan: input.strategy === 'autonomous' && input.sensors?.hazard !== 'none',
        scanAltitudeM: 250, divertRadiusM: 120,   // the autopilot's defaults
        legRadiusM: flight.lander.legRadiusM, maxSlopeDeg: flight.lander.limits.maxSlopeDeg, maxRoughnessM: flight.lander.limits.maxRoughnessM,
      };
      const pilot = createManualPilot();
      scene.fly(flight, setup, {
        controls: manual ? dt => pilot.update(keysToPilotInput(pressed.current), dt) : undefined,
        onEvent: e => setEvents(list => [...list, e]),
        onEnd: s => setSummary(s),
      });
      view.current = scene; sim.current = flight;
      setStarted(true); setPaused(false); setSummary(null); setEvents([]); setError(''); setHud(snapshot(flight.state));
    } catch (e) {
      // most likely WebGL is not available: fall back to the 2D view
      unavailable.current(e instanceof Error ? e.message : 'the 3D scene could not start');
    }
    // speed, camera and sound apply live below; they must not restart the flight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, mission, profile, entry, weather, manual]);

  const autoStarted = useRef(false);
  useEffect(() => { if (autoStart && pack && !autoStarted.current) { autoStarted.current = true; launch(); } }, [autoStart, pack, launch]);
  // Unmounting drops the view, so a remount (React StrictMode mounts twice in development) must start
  // the flight again; with the terrain already cached, the first mount launches before that happens.
  useEffect(() => () => { view.current?.dispose(); view.current = null; autoStarted.current = false; }, []);
  useEffect(() => { if (view.current) view.current.speed = speed; }, [speed]);
  useEffect(() => { if (view.current) view.current.camMode = camera; }, [camera]);
  useEffect(() => { view.current?.setMuted(muted); }, [muted]);
  useEffect(() => { if (view.current) view.current.paused = paused; }, [paused]);

  // readouts, and the same out-of-terrain stop as the 2D view
  useEffect(() => {
    if (!started) return;
    const boundX = (profile.manifest.grid.columns - 1) * profile.sampleSpacingM / 2;
    const boundY = (profile.manifest.grid.rows - 1) * profile.sampleSpacingM / 2;
    const timer = setInterval(() => {
      const state = sim.current?.state; if (!state) return;
      setHud(snapshot(state));
      if (!state.done && (Math.abs(state.position.x) > boundX || Math.abs(state.position.y) > boundY)) {
        setPaused(true); setError('Flight left the measured terrain patch. This run is stopped; restart or change the configuration.');
      }
    }, 100);
    return () => clearInterval(timer);
  }, [started, profile]);

  // keyboard for manual flight
  useEffect(() => {
    if (!manual) return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code.startsWith('Arrow')) e.preventDefault();
      pressed.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => pressed.current.delete(e.code);
    const clear = () => pressed.current.clear();
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); };
  }, [manual]);

  return <section className="flight-workspace"><div className="flight-toolbar"><div><strong>{mission.planetaryTarget.name} descent</strong><small>{mission.earthAnalog.name} · Measured Earth terrain · live 3D</small></div><div>
      <button className="subtle-button" onClick={onExit}>{started && !summary ? 'End flight & configure' : 'Back to configuration'}</button>
      <button className="primary-button" disabled={!pack} onClick={launch}>{started ? 'Restart flight' : 'Start descent'}</button>
      {started && !summary && !error && <button className="subtle-button" onClick={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</button>}
      <label>Playback <select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
      <label>Camera <select aria-label="Camera" value={camera} onChange={e => setCamera(e.target.value as CamMode)}><option value="auto">Auto</option><option value="chase">Chase</option><option value="orbit">Orbit</option><option value="ground">Ground</option><option value="top">Top</option></select></label>
      <button className="subtle-button" aria-pressed={!muted} onClick={() => setMuted(m => !m)}>{muted ? 'Sound on' : 'Sound off'}</button>
      {toolbarExtra}
    </div></div>
    <div className="flight-stage flight-stage-3d"><div ref={box} className="flight-3d" />
      {!started && <div className="launch-overlay"><h2>{pack ? 'Ready for descent' : 'Loading terrain…'}</h2><p>Start 1,000 m above ground, 400 m west of the target.<br />Initial velocity: 25 m/s east and 20 m/s down.</p>{pack && <button className="primary-button" onClick={launch}>Start descent</button>}</div>}
    </div>
    {error && <p role="alert" className="import-error">{error}</p>}
    <div className="flight-hud">{[['Elapsed', `${(hud?.t ?? 0).toFixed(1)} s`], ['Altitude AGL', `${(hud?.altitudeAGL ?? 1000).toFixed(1)} m`], ['Vertical velocity', `${(hud?.velocity.z ?? -20).toFixed(2)} m/s`], ['Fuel', `${(hud?.fuelKg ?? mission.strategy.fuelMassKg).toFixed(1)} kg`], ['Throttle', `${((hud?.throttle ?? 0) * 100).toFixed(0)}%`]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <p className="flight-help">{manual ? 'Keyboard: hold W/S to raise/lower throttle; arrow keys steer; X cuts the engine.' : 'Autonomous hazard-avoidance guidance is active after launch.'} Physics runs at a fixed 1/120 s timestep. Terrain does not resolve footpad-scale hazards; surface colours, small rocks and fine relief in the 3D view are illustrative.</p>
    {summary && !error && <div className="flight-result" role="status"><div><h2>{summary.outcome === 'success' ? 'Touchdown complete' : `Flight ended: ${summary.outcome}`}</h2><p>{summary.failureReasons.join(' · ') || 'Landing stayed within the configured model limits.'}</p></div><button className="primary-button" onClick={() => { if (sim.current) onReport(sim.current.telemetry()); }}>View flight report</button></div>}
    <details className="model-assumptions"><summary>Model assumptions & recent events</summary><p>Selected modelled weather supplies wind and air density when enabled; otherwise the model uses Earth 1.225 kg/m³, Mars 0.02, or lunar vacuum. Engine defaults: 311 s Isp, drag coefficient 1.2, reference area 15 m², leg radius 2.5 m and a velocimeter. Hazard sensor: {mission.strategy.hazardSensor}. These are simulation assumptions, not measured site conditions. The 3D scene shows the Earth site with Earth sky even under Moon or Mars gravity; camera and vehicle appearance are illustrative.</p><ul>{events.slice(-8).map((e, i) => <li key={i}>{e.t.toFixed(1)} s — {e.type}</li>)}</ul></details>
  </section>;
}

function snapshot(s: SimState): SimState {
  return { ...s, position: { ...s.position }, velocity: { ...s.velocity } };
}
