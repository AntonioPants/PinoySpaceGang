import { defaultAppearance, type LanderAppearance } from '../../lib/landerAppearance';
import type { MissionSettings } from '../../lib/types';
import { equipmentLoadouts } from '../equipment';
import { gearDetail, isGearPreset, withGear } from '../../lib/gear';

/** Yousef owns replacement data and physics mappings. These are explicitly prototype choices.
 * The gear figures come from the presets the simulation flies (lib/gear.ts), so the text cannot drift from the physics. */
export const vehicles = equipmentLoadouts.map(v => ({ ...v, detail: `${v.settings.dryMassKg?.toLocaleString()} kg dry · ${(v.settings.thrusterForceN! / 1000).toFixed(0)} kN thrust` }));
export const landingGear = [
  { id: 'standard-four', name: 'Four-point gear', role: 'Balanced', detail: gearDetail('standard-four') },
  { id: 'wide-four', name: 'Wide stance gear', role: 'Holds steeper slopes; a stiffer, shorter stroke', detail: gearDetail('wide-four') },
  { id: 'survey-six', name: 'Six-point gear', role: 'Takes the hardest, roughest touchdowns; heaviest', detail: gearDetail('survey-six') },
] as const;
export const sensors: { id: MissionSettings['hazardSensor']; name: string; detail: string }[] = [
  { id: 'lidar', name: 'Lidar scanner', detail: 'Active terrain sensing for hazard avoidance.' },
  { id: 'camera', name: 'Navigation camera', detail: 'Optical sensing. Glare affects hazard detection.' },
  { id: 'none', name: 'No hazard sensor', detail: 'A blind landing experiment without terrain detection.' },
];
export interface EquipmentSelection extends LanderAppearance { vehicleId: string; landingGearId: string; hazardSensor: MissionSettings['hazardSensor'] }
export const initialEquipment: EquipmentSelection = { vehicleId: vehicles[0].id, landingGearId: landingGear[0].id, hazardSensor: 'lidar', ...defaultAppearance };
export function equipmentSettings(selection: EquipmentSelection, previous: MissionSettings): MissionSettings {
  const vehicle = vehicles.find(v=>v.id===selection.vehicleId);
  if(!vehicle || !landingGear.some(g=>g.id===selection.landingGearId) || !sensors.some(s=>s.id===selection.hazardSensor)) throw new Error('Select available equipment before launching.');
  if(!isGearPreset(selection.landingGearId)) throw new Error('Select available equipment before launching.');
  const next={...previous,...vehicle.settings,hazardSensor:selection.hazardSensor};
  // Fitting a different gear resets its stroke, damping and slope rating to that gear's own;
  // the same gear keeps whatever the player trimmed on the bridge.
  return previous.landingGearId===selection.landingGearId?next:withGear(next,selection.landingGearId);
}
