import type { Interference, Observation, SensorSuite, SimState } from './types.ts';
import { DUST_ALTITUDE_M } from './constants.ts';
import type { Rng } from './rng.ts';
import { HAZARD_SENSORS } from './hazardSensors.ts';

/**
 * Turns ground truth into what the guidance computer sees.
 * - Dust (plume-lifted regolith or snow) only matters near the ground: it adds noise and
 *   dropouts to the altimeter and velocimeter below DUST_ALTITUDE_M.
 * - Without a Doppler velocimeter, velocity comes from noisier IMU integration.
 * Glare is handled by the hazard-detection terrain view (see engine.ts).
 */
export function createSensorModel(suite: SensorSuite, interference: Interference, rng: Rng) {
  let last: Observation | undefined;
  // The descent sensors set the velocity noise and how much dust matters (hazardSensors.ts).
  const profile = HAZARD_SENSORS[suite.hazard] ?? HAZARD_SENSORS.lidar;

  return function observe(s: SimState): Observation {
    const dustNow = s.altitudeAGL < DUST_ALTITUDE_M && s.throttle > 0 ? interference.dust : 0;
    const altSigma = 0.05 + 0.01 * s.altitudeAGL ** 0.5 + 1.5 * profile.dustScale * dustNow;
    const velSigma = (suite.velocimeter ? profile.velocitySigmaMps : 0.4) + 0.5 * profile.dustScale * dustNow;
    const dropout = 0.35 * profile.dropoutScale * dustNow;

    const altimeterValid = !(last && rng.next() < dropout);
    const velocimeterValid = !(last && rng.next() < dropout);

    const obs: Observation = {
      t: s.t,
      position: { ...s.position },
      velocity: velocimeterValid
        ? {
            x: s.velocity.x + velSigma * rng.gaussian(),
            y: s.velocity.y + velSigma * rng.gaussian(),
            z: s.velocity.z + velSigma * rng.gaussian(),
          }
        : { ...last!.velocity },
      altitudeAGL: altimeterValid ? Math.max(0, s.altitudeAGL + altSigma * rng.gaussian()) : last!.altitudeAGL,
      tiltX: s.tiltX,
      tiltY: s.tiltY,
      fuelKg: s.fuelKg,
      massKg: s.massKg,
      altimeterValid,
      velocimeterValid,
    };
    last = obs;
    return obs;
  };
}
