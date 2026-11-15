/**
 * Hazard and navigation sensors, as the physics uses them.
 *
 * A sensor is described by what it does to the flight, not by a label:
 *
 *  - Hazard map. A sensor that maps the ground gives guidance a copy of the terrain with noise:
 *        σ = baseNoiseM + glareNoiseM · glare      (m, value noise on a lattice of cellM)
 *    and obstacles smaller than 0.8 σ disappear from it (terrain.ts noisyField). A coarse lattice
 *    blurs slopes; noise hides rocks. Without a map, guidance can neither divert nor look ahead.
 *  - When and how far it can act. The map is read once, at scanAltitudeM above the ground, and the
 *    vehicle may divert at most divertRadiusM from its aim (controllers/autopilot.ts).
 *  - Velocity and altitude. The descent sensors set the velocity noise, and how much plume dust
 *    adds to it and to dropouts (sensors.ts):
 *        σ_v = velocitySigmaMps + 0.5 · dustScale · dust,  dropout = 0.35 · dropoutScale · dust,
 *        σ_h = 0.05 + 0.01 · √h + 1.5 · dustScale · dust
 *    Radar sees through dust far better than optical sensors.
 *
 * The first three are the original prototype sensors and keep their original numbers. The rest
 * are after sensors that flew on real landers. Their figures are approximate, chosen to reproduce
 * each sensor's character (resolution, range, glare and dust sensitivity), not measured values.
 */
import type { HazardSensorId } from './types.ts';

export interface HazardSensorProfile {
  name: string;
  /** Builds a hazard map that guidance can divert on. */
  map: boolean;
  /** Map noise in any light, m. */
  baseNoiseM: number;
  /** Map noise added per unit glare (0..1), m. */
  glareNoiseM: number;
  /** Map lattice, m: what the sensor resolves. */
  cellM: number;
  /** Height above ground at which the map is read, m. */
  scanAltitudeM: number;
  /** Furthest a divert may go from the aim point, m. */
  divertRadiusM: number;
  /** Velocity noise in clear air with a velocimeter fitted, m/s. */
  velocitySigmaMps: number;
  /** Multiplies plume dust's effect on the altimeter and velocimeter noise. */
  dustScale: number;
  /** Multiplies plume dust's effect on reading dropouts. */
  dropoutScale: number;
}

const prototype = { scanAltitudeM: 250, divertRadiusM: 120, velocitySigmaMps: 0.03, dustScale: 1, dropoutScale: 1, baseNoiseM: 0, cellM: 1.5 };

export const HAZARD_SENSORS: Record<HazardSensorId, HazardSensorProfile> = {
  lidar: { ...prototype, name: 'Lidar scanner', map: true, glareNoiseM: 0.15 },
  camera: { ...prototype, name: 'Navigation camera', map: true, glareNoiseM: 1.0 },
  none: { ...prototype, name: 'No hazard sensor', map: false, glareNoiseM: 0 },
  // Apollo: the commander picked the spot through the window with the Landing Point Designator;
  // the landing radar gave altitude and velocity. Eyes read the ground late and coarsely, are
  // dazzled by a low sun, but can fly a long way to a better spot. Radar shrugs off the dust.
  'crew-window': { name: 'Crew window + landing radar', map: true, baseNoiseM: 0.2, glareNoiseM: 0.7, cellM: 3, scanAltitudeM: 150, divertRadiusM: 400, velocitySigmaMps: 0.05, dustScale: 0.5, dropoutScale: 0.4 },
  // Surveyor RADVS, Viking, Phoenix and MSL terminal-descent radar: excellent velocity and
  // altitude through dust, but no picture of the ground, so nothing to divert on.
  'landing-radar': { name: 'Landing radar', map: false, baseNoiseM: 0, glareNoiseM: 0, cellM: 1.5, scanAltitudeM: 250, divertRadiusM: 0, velocitySigmaMps: 0.025, dustScale: 0.25, dropoutScale: 0.2 },
  // Chang'e 3/4: optical coarse avoidance, then a hover about 100 m up to image the ground with a
  // laser 3D imager. A sharp map almost blind to glare, read late, with a short divert.
  'flash-lidar': { name: 'Laser 3D imager (hover)', map: true, baseNoiseM: 0, glareNoiseM: 0.05, cellM: 0.6, scanAltitudeM: 100, divertRadiusM: 60, velocitySigmaMps: 0.03, dustScale: 1, dropoutScale: 1 },
  // Chandrayaan-3: the Lander Hazard Detection and Avoidance Camera, with a laser Doppler
  // velocimeter. A fine optical map that still suffers glare; a precise velocity.
  'hazard-camera': { name: 'Hazard camera + laser Doppler', map: true, baseNoiseM: 0.1, glareNoiseM: 0.8, cellM: 1, scanAltitudeM: 150, divertRadiusM: 150, velocitySigmaMps: 0.02, dustScale: 0.8, dropoutScale: 0.8 },
  // SLIM and Mars 2020: terrain-relative navigation, matching camera images to an onboard map made
  // from orbit. It decides early and can go far, but an orbital map misses small rocks.
  'terrain-nav': { name: 'Terrain-relative navigation', map: true, baseNoiseM: 0.35, glareNoiseM: 0.3, cellM: 2, scanAltitudeM: 600, divertRadiusM: 300, velocitySigmaMps: 0.03, dustScale: 1, dropoutScale: 1 },
  // Nova-C: NASA's Navigation Doppler Lidar. Very precise velocity and range, no hazard map.
  'doppler-lidar': { name: 'Navigation Doppler lidar', map: false, baseNoiseM: 0, glareNoiseM: 0, cellM: 1.5, scanAltitudeM: 250, divertRadiusM: 0, velocitySigmaMps: 0.01, dustScale: 0.6, dropoutScale: 0.5 },
};

export const HAZARD_SENSOR_IDS = Object.keys(HAZARD_SENSORS) as HazardSensorId[];
export const isHazardSensor = (id: unknown): id is HazardSensorId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(HAZARD_SENSORS, id);
/** Map noise for this sensor in this glare, m. */
export const hazardMapNoiseM = (p: HazardSensorProfile, glare: number) => p.baseNoiseM + p.glareNoiseM * glare;
/**
 * How well the sensor sees the ground in this glare, 0..1: 1 minus its map noise in metres, so a
 * map with 1 m of noise (a camera at full glare) shows nothing worth trusting. For displays only:
 * the flight reads the noise itself (engine.ts), never this number.
 */
export const hazardMapQuality = (p: HazardSensorProfile, glare: number) => (p.map ? Math.min(1, Math.max(0, 1 - hazardMapNoiseM(p, glare))) : 0);
