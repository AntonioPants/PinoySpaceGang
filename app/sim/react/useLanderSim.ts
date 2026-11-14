import { useCallback, useEffect, useRef, useState } from 'react';
import { createManualPilot, createSim, keysToPilotInput } from '../src/index.ts';
import type { FlightSummary, Sim, SimEvent, SimInput, SimState } from '../src/index.ts';

export interface LaunchOptions {
  /** Fast-forward the flight to this sim time (s) before playback starts. */
  at?: number;
}

export interface UseLanderSimOptions {
  /** How often the React-visible `hud` snapshot refreshes. Canvases should draw from `sim` in onFrame instead. Default 15. */
  hudHz?: number;
  /** Listen to the keyboard for manual flight (W/S throttle, arrows tilt, X cut). Default true. */
  keyboard?: boolean;
  /** Initial playback speed multiplier. Default 1. */
  speed?: number;
}

export type FrameListener = (sim: Sim, dtReal: number, input: SimInput) => void;

/**
 * Runs a lander simulation inside a React app.
 *
 * The physics steps in a requestAnimationFrame loop outside React's render cycle. React state
 * (`hud`, `events`, `summary`) is updated at a throttled rate, so the UI never re-renders at
 * 120 Hz. Canvas / Three.js views should register with `onFrame` and read `sim.state` directly.
 *
 *   const lander = useLanderSim();
 *   lander.launch({ site, strategy: 'autonomous' });
 *   useEffect(() => lander.onFrame((sim) => draw(sim.state)), [lander.onFrame]);
 */
export function useLanderSim(opts: UseLanderSimOptions = {}) {
  const hudEvery = 1 / (opts.hudHz ?? 15);
  const simRef = useRef<Sim | null>(null);
  const inputRef = useRef<SimInput | null>(null);
  const pilotRef = useRef(createManualPilot());
  const pressed = useRef(new Set<string>());
  const listeners = useRef(new Set<FrameListener>());
  const pausedRef = useRef(false);
  const speedRef = useRef(opts.speed ?? 1);

  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState<SimState | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [summary, setSummary] = useState<FlightSummary | undefined>();
  const [paused, setPausedState] = useState(false);
  const [speed, setSpeedState] = useState(speedRef.current);

  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
  }, []);
  const togglePause = useCallback(() => setPaused(!pausedRef.current), [setPaused]);
  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const launch = useCallback(
    (input: SimInput, launchOpts: LaunchOptions = {}) => {
      const sim = createSim(input);
      sim.on((e) => setEvents((prev) => [...prev, e]));
      if (launchOpts.at) while (!sim.state.done && sim.state.t < launchOpts.at) sim.step();
      simRef.current = sim;
      inputRef.current = input;
      pilotRef.current = createManualPilot();
      setEvents([...sim.events]);
      setSummary(sim.telemetry().summary);
      setHud(snapshot(sim.state));
      setPaused(false);
      setRunId((n) => n + 1);
    },
    [setPaused],
  );

  const onFrame = useCallback((fn: FrameListener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  // physics + render loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let sinceHud = 0;
    const loop = (now: number) => {
      const dtReal = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      if (sim) {
        if (!pausedRef.current && !sim.state.done) {
          const dtSim = dtReal * speedRef.current;
          const manual = inputRef.current?.strategy === 'manual';
          const controls = manual ? pilotRef.current.update(keysToPilotInput(pressed.current), dtSim) : undefined;
          sim.advance(dtSim, controls);
          if (sim.state.done) setSummary(sim.telemetry().summary);
        }
        sinceHud += dtReal;
        if (sinceHud >= hudEvery) {
          sinceHud = 0;
          setHud(snapshot(sim.state));
        }
      }
      if (sim && inputRef.current) for (const l of listeners.current) l(sim, dtReal, inputRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hudEvery]);

  // keyboard for manual flight
  useEffect(() => {
    if (opts.keyboard === false) return;
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      if (e.code.startsWith('Arrow')) e.preventDefault();
      pressed.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => pressed.current.delete(e.code);
    const clear = () => pressed.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, [opts.keyboard]);

  return {
    /** The live simulation (null before the first launch). Read it in onFrame, not during render. */
    sim: simRef.current,
    input: inputRef.current,
    /** Increments on every launch; use it as an effect dependency to reset per-flight visuals. */
    runId,
    hud,
    events,
    summary,
    paused,
    setPaused,
    togglePause,
    speed,
    setSpeed,
    launch,
    onFrame,
  };
}

function snapshot(s: SimState): SimState {
  return { ...s, position: { ...s.position }, velocity: { ...s.velocity } };
}
