import type { Controls } from '../types.ts';
import { DEG } from '../constants.ts';

/** Raw pilot input, e.g. from keyboard or gamepad. Sticks are -1..1. */
export interface PilotInput {
  /** +1 = throttle up, -1 = throttle down, 0 = hold. */
  throttleAxis: number;
  /** -1..1 → tilt towards -x/+x. */
  stickX: number;
  /** -1..1 → tilt towards -y/+y. */
  stickY: number;
  /** Instant engine cut. */
  cutEngine?: boolean;
}

/**
 * Manual thruster/gimbal control: the throttle ramps while the key is held, the stick maps
 * linearly to commanded tilt. Feed the result into sim.step()/sim.advance().
 *
 * Suggested keys: W/S throttle, arrows (or WASD on a second scheme) for tilt, X to cut.
 */
export function createManualPilot(opts: { throttleRatePerS?: number; maxTiltDeg?: number } = {}) {
  const rate = opts.throttleRatePerS ?? 0.5;
  const maxTilt = (opts.maxTiltDeg ?? 20) * DEG;
  let throttle = 0;
  return {
    get throttle() {
      return throttle;
    },
    update(input: PilotInput, dt: number): Controls {
      throttle = input.cutEngine ? 0 : Math.min(1, Math.max(0, throttle + input.throttleAxis * rate * dt));
      return {
        throttle,
        tiltX: Math.max(-1, Math.min(1, input.stickX)) * maxTilt,
        tiltY: Math.max(-1, Math.min(1, input.stickY)) * maxTilt,
      };
    },
  };
}

/** Maps a set of currently-pressed `KeyboardEvent.code`s to PilotInput. */
export function keysToPilotInput(pressed: ReadonlySet<string>): PilotInput {
  const axis = (pos: string[], neg: string[]) =>
    (pos.some((k) => pressed.has(k)) ? 1 : 0) - (neg.some((k) => pressed.has(k)) ? 1 : 0);
  return {
    throttleAxis: axis(['KeyW', 'ShiftLeft'], ['KeyS', 'ControlLeft']),
    stickX: axis(['ArrowRight', 'KeyD'], ['ArrowLeft', 'KeyA']),
    stickY: axis(['ArrowUp'], ['ArrowDown']),
    cutEngine: pressed.has('KeyX'),
  };
}
