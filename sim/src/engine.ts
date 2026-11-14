import type {
  Body,
  Controls,
  EnvironmentMode,
  FlightSummary,
  FlightTelemetry,
  LanderConfig,
  Observation,
  SimEvent,
  SimInput,
  SimState,
  SiteTerrain,
  TelemetrySample,
  Vec2,
  Vec3,
} from './types.ts';
import {
  BODIES,
  DEFAULT_INTERFERENCE,
  DEFAULT_LANDER,
  DEFAULT_SENSORS,
  DEG,
  DUST_ALTITUDE_M,
  FUEL_LOW_FRACTION,
  G0,
} from './constants.ts';
import { createRng } from './rng.ts';
import { GridTerrain, noisyField, roughnessAt, slopeDegAt, type HeightField } from './terrain.ts';
import { evaluateTouchdown } from './touchdown.ts';
import { createSensorModel } from './sensors.ts';
import { autopilot } from './controllers/autopilot.ts';

export interface ControllerContext {
  dt: number;
  gravity: number;
  airDensity: number;
  lander: LanderConfig;
  /** Current aim point (starts at input.target). */
  aim: Vec2;
  /**
   * What the hazard sensor sees of the terrain (noisy under glare), or null without one.
   * Controllers must use this, never the true terrain.
   */
  hazardView: HeightField | null;
  emit(e: SimEvent): void;
  /** Retarget guidance (e.g. after a hazard divert). */
  setAim(p: Vec2): void;
}

export interface Controller {
  update(obs: Observation, ctx: ControllerContext): Controls;
}

export interface Sim {
  readonly state: Readonly<SimState>;
  readonly events: readonly SimEvent[];
  readonly terrain: GridTerrain;
  readonly lander: LanderConfig;
  readonly gravity: number;
  readonly airDensity: number;
  /** Advance exactly one fixed timestep. Pass controls for manual flight; omit to use the controller. */
  step(controls?: Controls): SimState;
  /** Advance by a render frame's worth of time (fixed-step accumulator). */
  advance(frameDt: number, controls?: Controls): SimState;
  /** Sensor reading for HUDs (what a pilot would see). */
  observe(): Observation;
  /** Subscribe to events as they happen. Returns an unsubscribe function. */
  on(listener: (e: SimEvent) => void): () => void;
  telemetry(): FlightTelemetry;
}

export function resolveLander(input: SimInput): LanderConfig {
  const { limits, ...rest } = input.lander ?? {};
  return { ...DEFAULT_LANDER, ...rest, limits: { ...DEFAULT_LANDER.limits, ...limits } };
}

function simulatedBody(site: SiteTerrain, mode: EnvironmentMode | undefined): Body {
  return mode === 'native' ? site.body : (site.analogOf ?? site.body);
}

export function resolveEnvironment(input: SimInput) {
  const { site } = input;
  const g = input.gravity ?? 'target';
  const a = input.atmosphere ?? 'target';
  const gravity =
    typeof g === 'number'
      ? g
      : g === 'native'
        ? (site.gravity ?? BODIES[site.body].gravity)
        : site.analogOf
          ? BODIES[site.analogOf].gravity
          : (site.gravity ?? BODIES[site.body].gravity);
  const airDensity =
    typeof a === 'number'
      ? a
      : a === 'native'
        ? (site.airDensity ?? BODIES[site.body].airDensity)
        : site.analogOf
          ? BODIES[site.analogOf].airDensity
          : (site.airDensity ?? BODIES[site.body].airDensity);
  return { gravity, airDensity, body: simulatedBody(site, typeof g === 'number' ? 'target' : g) };
}

export function createSim(input: SimInput, controllerOverride?: Controller): Sim {
  const lander = resolveLander(input);
  const env = resolveEnvironment(input);
  const sensors = { ...DEFAULT_SENSORS, ...input.sensors };
  const interference = { ...DEFAULT_INTERFERENCE, ...input.interference };
  const seed = input.seed ?? 1;
  const rng = createRng(seed);
  const dt = input.dt ?? 1 / 120;
  const maxTime = input.maxTimeS ?? 600;
  const sampleEvery = 1 / (input.sampleHz ?? 10);
  const terrain = new GridTerrain(input.site.heightmap);
  const wind = input.site.wind ?? { x: 0, y: 0 };
  const target: Vec2 = { ...(input.target ?? { x: 0, y: 0 }) };
  let aim: Vec2 = { ...target };

  const controller =
    controllerOverride ??
    (input.strategy === 'autonomous' ? autopilot({ hazardAvoidance: sensors.hazard !== 'none' }) : undefined);

  const glareSigma = sensors.hazard === 'camera' ? 1.0 * interference.glare : 0.15 * interference.glare;
  const hazardView =
    sensors.hazard === 'none' ? null : noisyField(terrain, glareSigma, seed ^ 0x9e3779b9, 1.5);
  const observeSensors = createSensorModel(sensors, interference, rng);

  const startPos = input.start?.position ?? { x: target.x - 400, y: target.y, z: 1000 };
  const startVel = input.start?.velocity ?? { x: 25, y: 0, z: -20 };
  const state: SimState = {
    t: 0,
    position: { x: startPos.x, y: startPos.y, z: terrain.heightAt(startPos.x, startPos.y) + startPos.z },
    velocity: { ...startVel },
    tiltX: 0,
    tiltY: 0,
    throttle: 0,
    fuelKg: lander.fuelKg,
    massKg: lander.dryMassKg + lander.fuelKg,
    altitudeAGL: startPos.z,
    done: false,
  };

  const events: SimEvent[] = [];
  const listeners = new Set<(e: SimEvent) => void>();
  const samples: TelemetrySample[] = [];
  let summary: FlightSummary | undefined;
  let lastControls: Controls = { throttle: 0, tiltX: 0, tiltY: 0 };
  let nextSampleT = 0;
  let accumulator = 0;
  let dustEmitted = false;
  let fuelLowEmitted = false;
  let fuelOutEmitted = false;
  let diverted = false;

  const emit = (e: SimEvent) => {
    events.push(e);
    for (const l of listeners) l(e);
  };

  const ctx: ControllerContext = {
    dt,
    gravity: env.gravity,
    airDensity: env.airDensity,
    lander,
    get aim() {
      return aim;
    },
    hazardView,
    emit,
    setAim(p) {
      if (p.x !== aim.x || p.y !== aim.y) diverted = true;
      aim = { ...p };
    },
  };

  const tiltDeg = () => Math.atan(Math.hypot(Math.tan(state.tiltX), Math.tan(state.tiltY))) / DEG;

  const record = () => {
    samples.push({
      t: round(state.t, 3),
      x: state.position.x,
      y: state.position.y,
      z: state.position.z,
      vx: state.velocity.x,
      vy: state.velocity.y,
      vz: state.velocity.z,
      altitudeAGL: state.altitudeAGL,
      tiltDeg: tiltDeg(),
      throttle: state.throttle,
      fuelKg: state.fuelKg,
    });
  };

  const finish = (s: Omit<FlightSummary, 'fuelRemainingKg' | 'fuelUsedKg' | 'flightTimeS' | 'target' | 'finalAimPoint' | 'diverted' | 'distanceFromTargetM' | 'landingPoint'>) => {
    state.done = true;
    state.outcome = s.outcome;
    summary = {
      ...s,
      flightTimeS: round(state.t, 3),
      fuelRemainingKg: state.fuelKg,
      fuelUsedKg: lander.fuelKg - state.fuelKg,
      landingPoint: { ...state.position },
      target,
      finalAimPoint: { ...aim },
      distanceFromTargetM: Math.hypot(state.position.x - target.x, state.position.y - target.y),
      diverted,
    };
    record();
  };

  const step = (controls?: Controls): SimState => {
    if (state.done) return state;

    let cmd = controls;
    if (!cmd && controller) cmd = controller.update(observeSensors(state), ctx);
    cmd = cmd ?? lastControls;
    lastControls = cmd;

    // --- actuators ---------------------------------------------------------------
    let throttle = clamp(cmd.throttle, 0, 1);
    if (throttle > 0 && throttle < lander.minThrottle) throttle = lander.minThrottle;
    if (state.fuelKg <= 0) throttle = 0;
    const wasOn = state.throttle > 0;
    state.throttle = throttle;
    if (!wasOn && throttle > 0) emit({ type: 'engineOn', t: state.t });
    if (wasOn && throttle === 0) emit({ type: 'engineOff', t: state.t });

    const maxTilt = lander.maxTiltDeg * DEG;
    const rate = lander.maxGimbalRateDegS * DEG * dt;
    state.tiltX += clamp(clamp(cmd.tiltX, -maxTilt, maxTilt) - state.tiltX, -rate, rate);
    state.tiltY += clamp(clamp(cmd.tiltY, -maxTilt, maxTilt) - state.tiltY, -rate, rate);

    // --- forces ------------------------------------------------------------------
    const mass = lander.dryMassKg + state.fuelKg;
    let thrust = throttle * lander.maxThrustN;
    const burn = (thrust / (lander.ispS * G0)) * dt;
    if (burn > state.fuelKg) {
      thrust *= state.fuelKg / burn; // partial final step
      state.fuelKg = 0;
    } else {
      state.fuelKg -= burn;
    }

    const dx = Math.tan(state.tiltX);
    const dy = Math.tan(state.tiltY);
    const dn = Math.hypot(dx, dy, 1);
    const relX = state.velocity.x - wind.x;
    const relY = state.velocity.y - wind.y;
    const relZ = state.velocity.z;
    const relSpeed = Math.hypot(relX, relY, relZ);
    const dragK = 0.5 * env.airDensity * relSpeed * lander.dragCoeff * lander.refAreaM2;

    const ax = ((thrust * dx) / dn - dragK * relX) / mass;
    const ay = ((thrust * dy) / dn - dragK * relY) / mass;
    const az = (thrust / dn - dragK * relZ) / mass - env.gravity;

    // semi-implicit Euler
    state.velocity.x += ax * dt;
    state.velocity.y += ay * dt;
    state.velocity.z += az * dt;
    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;
    state.position.z += state.velocity.z * dt;
    state.t += dt;
    state.massKg = lander.dryMassKg + state.fuelKg;

    const ground = terrain.heightAt(state.position.x, state.position.y);
    state.altitudeAGL = state.position.z - ground;

    // --- events ------------------------------------------------------------------
    if (!dustEmitted && throttle > 0 && state.altitudeAGL < DUST_ALTITUDE_M) {
      dustEmitted = true;
      emit({
        type: 'dustKickup',
        t: state.t,
        altitudeM: state.altitudeAGL,
        intensity: clamp(0.3 + throttle * 0.5 + interference.dust * 0.5, 0, 1),
      });
    }
    if (!fuelLowEmitted && state.fuelKg < lander.fuelKg * FUEL_LOW_FRACTION) {
      fuelLowEmitted = true;
      emit({ type: 'fuelLow', t: state.t, fuelKg: state.fuelKg });
    }
    if (!fuelOutEmitted && state.fuelKg <= 0) {
      fuelOutEmitted = true;
      emit({ type: 'fuelOut', t: state.t });
    }

    // --- contact -----------------------------------------------------------------
    if (state.altitudeAGL <= 0) {
      const vVert = Math.max(0, -state.velocity.z);
      const vHoriz = Math.hypot(state.velocity.x, state.velocity.y);
      const slope = slopeDegAt(terrain, state.position.x, state.position.y, lander.legRadiusM);
      const rough = roughnessAt(terrain, state.position.x, state.position.y, lander.legRadiusM);
      const tilt = tiltDeg();
      const res = evaluateTouchdown(
        { verticalSpeedMps: vVert, horizontalSpeedMps: vHoriz, slopeDeg: slope, roughnessM: rough, tiltDeg: tilt },
        lander.limits,
      );
      state.position.z = ground;
      state.altitudeAGL = 0;
      state.velocity = { x: 0, y: 0, z: 0 };
      if (state.throttle > 0) {
        state.throttle = 0;
        emit({ type: 'engineOff', t: state.t });
      }
      const pos = { ...state.position };
      emit({ type: 'touchdown', t: state.t, outcome: res.outcome, position: pos, verticalSpeedMps: vVert, horizontalSpeedMps: vHoriz });
      if (res.outcome === 'crash') emit({ type: 'crash', t: state.t, position: pos, impactSpeedMps: Math.hypot(vVert, vHoriz) });
      if (res.outcome === 'tip-over') emit({ type: 'tipOver', t: state.t, position: pos, slopeDeg: slope });
      finish({
        outcome: res.outcome,
        survivability: res.survivability,
        failureReasons: res.reasons,
        verticalSpeedMps: vVert,
        horizontalSpeedMps: vHoriz,
        slopeDeg: slope,
        roughnessM: rough,
        tiltDeg: tilt,
      });
      return state;
    }

    if (state.t >= maxTime) {
      emit({ type: 'timeout', t: state.t });
      finish({
        outcome: 'timeout',
        survivability: 0,
        failureReasons: [`did not land within ${maxTime} s`],
        verticalSpeedMps: -state.velocity.z,
        horizontalSpeedMps: Math.hypot(state.velocity.x, state.velocity.y),
        slopeDeg: 0,
        roughnessM: 0,
        tiltDeg: tiltDeg(),
      });
      return state;
    }

    if (state.t >= nextSampleT) {
      record();
      nextSampleT += sampleEvery;
    }
    return state;
  };

  record();
  nextSampleT = sampleEvery;

  return {
    get state() {
      return state;
    },
    events,
    terrain,
    lander,
    gravity: env.gravity,
    airDensity: env.airDensity,
    step,
    advance(frameDt, controls) {
      accumulator += Math.min(frameDt, 0.25);
      while (accumulator >= dt && !state.done) {
        step(controls);
        accumulator -= dt;
      }
      return state;
    },
    observe: () => observeSensors(state),
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    telemetry: () => ({
      siteId: input.site.id,
      strategy: input.strategy,
      environment: { gravity: env.gravity, airDensity: env.airDensity, simulatedBody: env.body },
      lander,
      samples,
      events,
      summary,
    }),
  };
}

/** Runs a whole flight headlessly and returns the telemetry for the report screen. */
export function runSim(
  input: SimInput,
  opts: { controller?: Controller; manual?: (s: Readonly<SimState>) => Controls } = {},
): FlightTelemetry {
  const sim = createSim(input, opts.controller);
  if (input.strategy === 'manual' && !opts.manual && !opts.controller) {
    throw new Error('manual strategy needs opts.manual (a scripted pilot) or opts.controller for headless runs');
  }
  while (!sim.state.done) sim.step(opts.manual ? opts.manual(sim.state) : undefined);
  return sim.telemetry();
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function round(v: number, d: number) {
  const k = 10 ** d;
  return Math.round(v * k) / k;
}

export type { Vec3 };
