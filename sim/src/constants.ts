import type { Body, LanderConfig, SensorSuite, Interference } from './types.ts';

/** Standard gravity, used in the rocket equation (mdot = T / (Isp * g0)). */
export const G0 = 9.80665;

/** Surface gravity (m/s^2) and near-surface air density (kg/m^3). */
export const BODIES: Record<Body, { gravity: number; airDensity: number }> = {
  moon: { gravity: 1.62, airDensity: 0 },
  mars: { gravity: 3.71, airDensity: 0.02 },
  earth: { gravity: 9.81, airDensity: 1.225 },
};

/**
 * Apollo Lunar Module class lander in its final descent phase.
 * Descent engine ~45 kN, Isp ~311 s, throttleable from ~10 %.
 * Touchdown limits from the LM landing-gear design envelope.
 */
export const DEFAULT_LANDER: LanderConfig = {
  name: 'Apollo LM class',
  dryMassKg: 7000,
  fuelKg: 1500,
  maxThrustN: 45040,
  minThrottle: 0.1,
  ispS: 311,
  dragCoeff: 1.2,
  refAreaM2: 15,
  legRadiusM: 2.5,
  maxGimbalRateDegS: 20,
  maxTiltDeg: 45,
  limits: {
    maxVerticalMps: 3.0,
    maxHorizontalMps: 1.2,
    maxSlopeDeg: 12,
    maxTiltDeg: 12,
    maxRoughnessM: 0.5,
  },
};

export const DEFAULT_SENSORS: SensorSuite = { hazard: 'lidar', velocimeter: true };
export const DEFAULT_INTERFERENCE: Interference = { dust: 0, glare: 0 };

/** Plume starts lifting regolith / snow below this height. */
export const DUST_ALTITUDE_M = 30;
/** fuelLow fires once at this fraction of the initial load. */
export const FUEL_LOW_FRACTION = 0.1;

export const DEG = Math.PI / 180;
