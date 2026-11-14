/**
 * Shared contracts for the descent simulation.
 *
 * Consumers:
 *  - Yousef & Antonio produce `SiteTerrain` (via sites.json -> parseSite()).
 *  - Eyad builds `SimInput` in the configurator and renders `FlightTelemetry` in the report.
 *  - Furgan subscribes to `SimEvent`s to trigger VFX, cutscenes and sound.
 *
 * Coordinates: metres, right-handed, x = east, y = north, z = up.
 * Lander position is the bottom of the landing legs.
 */

export type Body = 'moon' | 'mars' | 'earth';

export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }

/** Regular elevation grid, row-major (row = y index, col = x index). */
export interface Heightmap {
  cols: number;
  rows: number;
  /** Metres between neighbouring samples. */
  cellSize: number;
  /** Elevation in metres, length rows * cols. */
  heights: ArrayLike<number>;
  /** World x/y of sample (col 0, row 0). Defaults to centring the grid on (0, 0). */
  originX?: number;
  originY?: number;
}

export interface SiteTerrain {
  id: string;
  name?: string;
  /** Where the terrain physically is. */
  body: Body;
  /** For Earth analog sites: which planetary body this terrain stands in for. */
  analogOf?: Exclude<Body, 'earth'>;
  heightmap: Heightmap;
  /** Mean surface wind, m/s (x = towards east, y = towards north). */
  wind?: Vec2;
  albedo?: number;
  soilType?: string;
  /** Overrides the body's default gravity (m/s^2). */
  gravity?: number;
  /** Overrides the body's default near-surface air density (kg/m^3). */
  airDensity?: number;
}

export interface TouchdownLimits {
  /** Max sink rate for a clean landing (Apollo LM: ~3.0 m/s). */
  maxVerticalMps: number;
  /** Max lateral speed before tip-over risk (Apollo LM: ~1.2 m/s). */
  maxHorizontalMps: number;
  /** Max ground slope under the legs (Apollo LM: ~12 deg). */
  maxSlopeDeg: number;
  /** Max body tilt from vertical at contact. */
  maxTiltDeg: number;
  /** Max deviation of a leg contact point from the local plane (rocks, crater rims). */
  maxRoughnessM: number;
}

export interface LanderConfig {
  name: string;
  dryMassKg: number;
  fuelKg: number;
  maxThrustN: number;
  /** Engine cannot throttle below this fraction while lit (Apollo DPS: ~0.1). */
  minThrottle: number;
  ispS: number;
  dragCoeff: number;
  refAreaM2: number;
  /** Distance from centre to each foot pad. */
  legRadiusM: number;
  maxGimbalRateDegS: number;
  /** Physical tilt limit of the attitude controller. */
  maxTiltDeg: number;
  limits: TouchdownLimits;
}

export type Strategy = 'autonomous' | 'manual';

/** 'target' = the body the site represents (analogOf, else body); 'native' = where it physically is. */
export type EnvironmentMode = 'target' | 'native' | number;

export interface SensorSuite {
  /** Hazard detection: lidar is robust to glare; none disables hazard avoidance. */
  hazard: 'lidar' | 'camera' | 'none';
  /** Doppler velocimeter; without it velocity comes from noisier IMU integration. */
  velocimeter: boolean;
}

export interface Interference {
  /** 0..1: dust / snow kicked up by the plume near the ground; degrades altimeter & velocimeter. */
  dust: number;
  /** 0..1: sun glare on snow / bright regolith; degrades camera-based hazard detection. */
  glare: number;
}

export interface SimInput {
  site: SiteTerrain;
  strategy: Strategy;
  lander?: Partial<Omit<LanderConfig, 'limits'>> & { limits?: Partial<TouchdownLimits> };
  /** Gravity to simulate: 'target' (default), 'native' or an explicit m/s^2. */
  gravity?: EnvironmentMode;
  /** Air density to simulate: 'target' (default), 'native' or explicit kg/m^3. */
  atmosphere?: EnvironmentMode;
  sensors?: Partial<SensorSuite>;
  interference?: Partial<Interference>;
  /** Intended landing point (x, y). Defaults to (0, 0). */
  target?: Vec2;
  /** Initial state. Position z is height above the terrain under the lander. */
  start?: { position?: Vec3; velocity?: Vec3 };
  seed?: number;
  /** Fixed physics timestep, s. Default 1/120. */
  dt?: number;
  /** Give up after this much simulated time, s. Default 600. */
  maxTimeS?: number;
  /** Telemetry sampling rate, Hz. Default 10. */
  sampleHz?: number;
}

/** What the lander is commanded to do this step. */
export interface Controls {
  /** 0 = engine off, otherwise 0..1 (values below minThrottle are raised to it). */
  throttle: number;
  /** Commanded body tilt, radians. Positive tiltX pushes the lander towards +x. */
  tiltX: number;
  tiltY: number;
}

export interface SimState {
  t: number;
  position: Vec3;
  velocity: Vec3;
  tiltX: number;
  tiltY: number;
  throttle: number;
  fuelKg: number;
  massKg: number;
  altitudeAGL: number;
  done: boolean;
  outcome?: Outcome;
}

/** What the guidance computer (or a human's HUD) sees — sensor readings, not ground truth. */
export interface Observation {
  t: number;
  position: Vec3;
  velocity: Vec3;
  altitudeAGL: number;
  tiltX: number;
  tiltY: number;
  fuelKg: number;
  massKg: number;
  /** False on a sensor dropout step (value held from the previous reading). */
  altimeterValid: boolean;
  velocimeterValid: boolean;
}

export type Outcome = 'success' | 'hard-landing' | 'tip-over' | 'crash' | 'timeout';

export type SimEvent =
  | { type: 'engineOn'; t: number }
  | { type: 'engineOff'; t: number }
  | { type: 'dustKickup'; t: number; altitudeM: number; intensity: number }
  | { type: 'hazardDetected'; t: number; at: Vec2; slopeDeg: number; roughnessM: number }
  | { type: 'divert'; t: number; from: Vec2; to: Vec2; distanceM: number }
  | { type: 'fuelLow'; t: number; fuelKg: number }
  | { type: 'fuelOut'; t: number }
  | {
      type: 'touchdown';
      t: number;
      outcome: Outcome;
      position: Vec3;
      verticalSpeedMps: number;
      horizontalSpeedMps: number;
    }
  | { type: 'crash'; t: number; position: Vec3; impactSpeedMps: number }
  | { type: 'tipOver'; t: number; position: Vec3; slopeDeg: number }
  | { type: 'timeout'; t: number };

export interface TelemetrySample {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  altitudeAGL: number;
  tiltDeg: number;
  throttle: number;
  fuelKg: number;
}

export interface FlightSummary {
  outcome: Outcome;
  /** 0..100, from how close the touchdown was to the limits. */
  survivability: number;
  failureReasons: string[];
  flightTimeS: number;
  verticalSpeedMps: number;
  horizontalSpeedMps: number;
  slopeDeg: number;
  roughnessM: number;
  tiltDeg: number;
  fuelRemainingKg: number;
  fuelUsedKg: number;
  landingPoint: Vec3;
  target: Vec2;
  /** Where guidance finally aimed (differs from target after a hazard divert). */
  finalAimPoint: Vec2;
  distanceFromTargetM: number;
  diverted: boolean;
}

export interface FlightTelemetry {
  siteId: string;
  strategy: Strategy;
  environment: { gravity: number; airDensity: number; simulatedBody: Body };
  lander: LanderConfig;
  samples: TelemetrySample[];
  events: SimEvent[];
  /** Undefined until the flight has ended. */
  summary?: FlightSummary;
}
