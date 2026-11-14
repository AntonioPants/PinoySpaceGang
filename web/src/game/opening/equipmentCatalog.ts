import type { MissionSettings } from '../../lib/types';
import { equipmentLoadouts } from '../equipment';

/** Yousef owns replacement data and physics mappings. These are explicitly prototype choices. */
export const vehicles = equipmentLoadouts.map(v => ({ ...v, detail: `${v.settings.dryMassKg?.toLocaleString()} kg dry · ${(v.settings.thrusterForceN! / 1000).toFixed(0)} kN thrust` }));
export const landingGear = [
  { id: 'standard-four', name: 'Four-point gear', detail: 'Compact stance with four circular footpads.' },
  { id: 'wide-four', name: 'Wide stance gear', detail: 'A wider four-leg layout for visual comparison.' },
  { id: 'survey-six', name: 'Six-point gear', detail: 'Six radial supports and broad contact pads.' },
] as const;
export const sensors: { id: MissionSettings['hazardSensor']; name: string; detail: string }[] = [
  { id: 'lidar', name: 'Lidar scanner', detail: 'Active terrain sensing for hazard avoidance.' },
  { id: 'camera', name: 'Navigation camera', detail: 'Optical sensing. Glare affects hazard detection.' },
  { id: 'none', name: 'No hazard sensor', detail: 'A blind landing experiment without terrain detection.' },
];
export interface EquipmentSelection { vehicleId: string; landingGearId: string; hazardSensor: MissionSettings['hazardSensor'] }
export const initialEquipment: EquipmentSelection = { vehicleId: vehicles[0].id, landingGearId: landingGear[0].id, hazardSensor: 'lidar' };
export function equipmentSettings(selection: EquipmentSelection, previous: MissionSettings): MissionSettings {
  const vehicle = vehicles.find(v=>v.id===selection.vehicleId);
  if(!vehicle || !landingGear.some(g=>g.id===selection.landingGearId) || !sensors.some(s=>s.id===selection.hazardSensor)) throw new Error('Select available equipment before launching.');
  // Gear changes no settings. Its footprint width reaches the physics through lib/gear.ts; everything
  // else about it waits for Yousef's validated gear parameters.
  return {...previous,...vehicle.settings,hazardSensor:selection.hazardSensor};
}
