import type { GearPresetId } from '../../../app/sim/src/gear';
import type { MissionSettings } from '../lib/types';

/**
 * Vehicles only. The slope the vehicle is rated for comes from its landing gear (lib/gear.ts).
 *
 * Besides the two prototype landers, the bay offers real landers flown to the Moon and Mars.
 * Their figures are approximate and describe the final, powered-descent phase that the
 * simulation flies, not the whole mission: dry mass is everything but the propellant left
 * for that phase, and thrust is the descent engines' combined maximum. Each brings its own
 * engine efficiency (Isp) and deepest throttle, so the physics burns fuel the way that
 * vehicle did: mass flow = thrust / (Isp × g0), and the delta-v it can spend follows the
 * rocket equation, Isp × g0 × ln(m0 / m1) (app/sim/src/engine.ts and assessment.ts).
 */
export interface VehicleLoadout {
  id: string; name: string; detail: string;
  /** Who flew it and when, for real vehicles. Absent for the prototypes. */
  history?: string;
  /** Larger landers are drawn with the bigger body. */
  size: 'small' | 'large';
  /** The gear it flew with, fitted when the vehicle is chosen (any gear can then be swapped in). */
  gear?: GearPresetId;
  settings: Partial<MissionSettings>;
}
const real = (id: string, name: string, history: string, size: VehicleLoadout['size'], hazardSensor: MissionSettings['hazardSensor'], gear: GearPresetId,
  dryMassKg: number, fuelMassKg: number, thrusterForceN: number, ispS: number, minThrottle: number): VehicleLoadout =>
  ({ id, name, history, size, gear, detail: history, settings: { dryMassKg, fuelMassKg, thrusterForceN, ispS, minThrottle, hazardSensor } });

export const equipmentLoadouts: VehicleLoadout[] = [
  { id: 'survey', name: 'Survey lander', size: 'small', detail: 'Lidar · 800 kg dry · 12 kN thrust', settings: { dryMassKg: 800, fuelMassKg: 350, thrusterForceN: 12000, hazardSensor: 'lidar' } },
  { id: 'payload', name: 'Payload lander', size: 'large', detail: 'Camera · 1,200 kg dry · 18 kN thrust', settings: { dryMassKg: 1200, fuelMassKg: 500, thrusterForceN: 18000, hazardSensor: 'camera' } },
  // Moon. Each real lander starts with the sensor and gear it flew with.
  real('apollo-lm', 'Apollo Lunar Module', 'NASA · Moon · 1969–72 · crewed', 'large', 'crew-window', 'apollo-four', 6800, 1500, 45040, 311, .1),
  real('surveyor', 'Surveyor', 'NASA · Moon · 1966–68 · three vernier engines', 'small', 'landing-radar', 'surveyor-three', 290, 70, 1390, 287, .22),
  real('change-3', "Chang'e 3 / 4", 'CNSA · Moon · 2013, 2019 far side · laser hazard imaging', 'large', 'flash-lidar', 'change-four', 1200, 300, 7500, 310, .2),
  real('vikram', 'Chandrayaan-3 Vikram', 'ISRO · Moon · 2023 · south polar region', 'large', 'hazard-camera', 'vikram-four', 1050, 250, 3200, 313, .4),
  real('slim', 'SLIM', 'JAXA · Moon · 2024 · vision-based pinpoint landing', 'small', 'terrain-nav', 'slim-five', 200, 60, 1000, 320, .2),
  real('nova-c', 'Nova-C Odysseus', 'Intuitive Machines · Moon · 2024 · methane-oxygen engine', 'large', 'doppler-lidar', 'nova-six', 675, 150, 3100, 320, .3),
  real('beresheet', 'Beresheet', 'SpaceIL · Moon · 2019 · lost after an engine shutdown', 'small', 'camera', 'standard-four', 150, 50, 400, 318, .5),
  // Mars: monopropellant hydrazine, so a much lower Isp than the Moon landers' bipropellant engines.
  real('viking', 'Viking Lander', 'NASA · Mars · 1976 · three throttleable engines', 'large', 'landing-radar', 'viking-three', 600, 85, 8000, 210, .1),
  real('phoenix', 'Phoenix / InSight', 'NASA · Mars · 2008, 2018 · twelve pulsed thrusters', 'small', 'landing-radar', 'viking-three', 360, 60, 3600, 220, .1),
  real('sky-crane', 'MSL Sky Crane', 'NASA · Mars · 2012, 2021 · eight engines lowering a rover', 'large', 'landing-radar', 'wide-four', 1730, 390, 24800, 220, .1),
];

export const isLargeVehicle = (id?: string) => equipmentLoadouts.find(l => l.id === id)?.size === 'large';
export const vehicleName = (id?: string) => equipmentLoadouts.find(l => l.id === id)?.name ?? 'Survey lander';

/** The loadout whose settings the player currently has, so the ship drawn matches the vehicle they set up. */
export function loadoutFor(settings: MissionSettings): string | undefined {
  return equipmentLoadouts.find(l => Object.entries(l.settings).every(([k, v]) => settings[k as keyof MissionSettings] === v))?.id;
}
