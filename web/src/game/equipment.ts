import type { MissionSettings } from '../lib/types';
export const equipmentLoadouts: { id: string; name: string; detail: string; settings: Partial<MissionSettings> }[] = [
  { id: 'survey', name: 'Survey lander', detail: 'Lidar · 800 kg dry · 12 kN thrust', settings: { dryMassKg: 800, fuelMassKg: 350, thrusterForceN: 12000, hazardSensor: 'lidar', maxSlopeToleranceDeg: 12 } },
  { id: 'payload', name: 'Payload lander', detail: 'Camera · 1,200 kg dry · 18 kN thrust', settings: { dryMassKg: 1200, fuelMassKg: 500, thrusterForceN: 18000, hazardSensor: 'camera', maxSlopeToleranceDeg: 10 } },
];
