/**
 * The parts of Tim's physics output the cutscenes read. These are structural copies of
 * FlightTelemetry / SimInput in app/sim/src/types.ts, so `sim.telemetry()` can be passed as is.
 * Sim coordinates: metres, x = east, y = north, z = up.
 */
export interface FlightSample {
  t: number; x: number; y: number; z: number; vx: number; vy: number; vz: number;
  altitudeAGL: number; tiltDeg: number; throttle: number;
}
export type FlightOutcome = "success" | "hard-landing" | "tip-over" | "crash" | "timeout";
export interface FlightLike {
  samples: FlightSample[];
  environment?: { gravity: number };
  summary?: {
    outcome: FlightOutcome; survivability: number; failureReasons: string[]; flightTimeS: number;
    verticalSpeedMps: number; horizontalSpeedMps: number; slopeDeg: number; tiltDeg: number;
    landingPoint: { x: number; y: number; z: number };
  };
}
/** Same shape and defaults as SimInput.start: where the simulation takes over from the opening. */
export interface StartState {
  position?: { x: number; y: number; z: number };   // z = height above the terrain under the lander
  velocity?: { x: number; y: number; z: number };
}
export const DEFAULT_START = { position: { x: -400, y: 0, z: 1000 }, velocity: { x: 25, y: 0, z: -20 } };
