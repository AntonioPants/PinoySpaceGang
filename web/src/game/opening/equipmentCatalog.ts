import { HAZARD_SENSORS, HAZARD_SENSOR_IDS } from '../../../../app/sim/src/hazardSensors';
import { defaultAppearance, type LanderAppearance } from '../../lib/landerAppearance';
import type { MissionSettings } from '../../lib/types';
import { equipmentLoadouts } from '../equipment';
import { gearDetail, isGearPreset, withGear } from '../../lib/gear';

/** Yousef owns replacement data and physics mappings. These are explicitly prototype choices.
 * The gear figures come from the presets the simulation flies (lib/gear.ts), so the text cannot drift from the physics. */
const kn = (n: number) => n < 10000 ? (n / 1000).toFixed(1) : (n / 1000).toFixed(0);
export const vehicles = equipmentLoadouts.map(v => ({ ...v, detail: `${v.history ? v.history + ' · ' : ''}${v.settings.dryMassKg?.toLocaleString()} kg dry · ${kn(v.settings.thrusterForceN!)} kN thrust${v.settings.ispS ? ` · Isp ${v.settings.ispS} s` : ''}` }));
export const landingGear = [
  { id: 'standard-four', name: 'Four-point gear', role: 'Balanced', detail: gearDetail('standard-four') },
  { id: 'wide-four', name: 'Wide stance gear', role: 'Holds steeper slopes; a stiffer, shorter stroke', detail: gearDetail('wide-four') },
  { id: 'survey-six', name: 'Six-point gear', role: 'Takes the hardest, roughest touchdowns; heaviest', detail: gearDetail('survey-six') },
  { id: 'apollo-four', name: 'Apollo LM gear', role: 'Crushable honeycomb on a wide stance: absorbs hard landings, very heavy', detail: gearDetail('apollo-four') },
  { id: 'surveyor-three', name: 'Surveyor tripod', role: 'Hydraulic shocks on three legs: light, but tips more easily', detail: gearDetail('surveyor-three') },
  { id: 'change-four', name: "Chang'e buffer legs", role: 'Long buffer stroke and large pads for soft ground', detail: gearDetail('change-four') },
  { id: 'vikram-four', name: 'Vikram reinforced legs', role: 'Strengthened to take about 3 m/s', detail: gearDetail('vikram-four') },
  { id: 'slim-five', name: 'SLIM lattice crush pads', role: '3D-printed pads that crush without bouncing; feather-light', detail: gearDetail('slim-five') },
  { id: 'nova-six', name: 'Nova-C six legs', role: 'Light and short-stroke: sensitive to sideways speed', detail: gearDetail('nova-six') },
  { id: 'viking-three', name: 'Viking / Phoenix tripod', role: 'Crushable honeycomb on three legs, for Mars', detail: gearDetail('viking-three') },
] as const;
const sensorText: Record<MissionSettings['hazardSensor'], string> = {
  lidar: 'Active terrain sensing for hazard avoidance.',
  camera: 'Optical sensing. Glare affects hazard detection.',
  none: 'A blind landing experiment without terrain detection.',
  'crew-window': 'Apollo: the crew picks the spot by eye, late and coarsely, and can fly far to a better one. Radar keeps speed through the dust.',
  'landing-radar': 'Surveyor, Viking, Phoenix, MSL: precise speed and height through dust, but no map of hazards to divert on.',
  'flash-lidar': "Chang'e: hovers about 100 m up and images the ground in 3D. Sharp and glare-proof, with a short divert.",
  'hazard-camera': 'Chandrayaan-3: a fine camera hazard map with a laser Doppler velocimeter. Glare still hurts.',
  'terrain-nav': 'SLIM, Mars 2020: matches images to an orbital map, decides early and diverts far, but misses small rocks.',
  'doppler-lidar': "Nova-C: NASA's Doppler lidar. The most precise speed, but no hazard map.",
};
/** Every sensor the physics models, with the figures it flies (app/sim/src/hazardSensors.ts). */
export const sensors: { id: MissionSettings['hazardSensor']; name: string; detail: string }[] = HAZARD_SENSOR_IDS.map(id => {
  const p = HAZARD_SENSORS[id];
  const map = p.map ? `maps hazards from ${p.scanAltitudeM} m at ${p.cellM} m detail, diverts up to ${p.divertRadiusM} m` : 'no hazard map';
  return { id, name: p.name, detail: id === 'none' ? sensorText[id] : `${sensorText[id]} (${map}; speed ±${p.velocitySigmaMps} m/s)` };
});
export interface EquipmentSelection extends LanderAppearance { vehicleId: string; landingGearId: string; hazardSensor: MissionSettings['hazardSensor'] }
export const initialEquipment: EquipmentSelection = { vehicleId: vehicles[0].id, landingGearId: landingGear[0].id, hazardSensor: 'lidar', ...defaultAppearance };
export function equipmentSettings(selection: EquipmentSelection, previous: MissionSettings): MissionSettings {
  const vehicle = vehicles.find(v=>v.id===selection.vehicleId);
  if(!vehicle || !landingGear.some(g=>g.id===selection.landingGearId) || !sensors.some(s=>s.id===selection.hazardSensor)) throw new Error('Select available equipment before launching.');
  if(!isGearPreset(selection.landingGearId)) throw new Error('Select available equipment before launching.');
  const next={...previous,ispS:undefined,minThrottle:undefined,...vehicle.settings,hazardSensor:selection.hazardSensor};
  // Fitting a different gear resets its stroke, damping and slope rating to that gear's own;
  // the same gear keeps whatever the player trimmed on the bridge.
  return previous.landingGearId===selection.landingGearId?next:withGear(next,selection.landingGearId);
}
