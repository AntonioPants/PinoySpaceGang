import { describe, expect, it } from 'vitest';
import { GEAR } from '../components/cutscene/lander';
import { landingGear } from '../game/opening/equipmentCatalog';
import { gearFootprintM } from './gear';
import { flightSetup } from './simulation';
import type { MissionConfig } from './types';

const mission = (equipment?: MissionConfig['equipment']) => ({
  planetaryTarget: { body: 'Moon' }, strategy: { mode: 'AUTONOMOUS_HAZARD_AVOID', dryMassKg: 800, fuelMassKg: 350, thrusterForceN: 12000, maxSlopeToleranceDeg: 12, hazardSensor: 'lidar' },
  environment: { interferenceSource: 'site', dust: 0, glare: 0 }, equipment,
}) as unknown as MissionConfig;
const withGear = (landingGearId: string) => mission({ vehicleId: 'v', landingGearId, hazardSensor: 'lidar', gearPhysics: 'footprint' });

describe('landing gear in the physics', () => {
  it('every gear the player can pick has a drawn footprint', () => {
    for (const g of landingGear) expect(GEAR[g.id]?.radius).toBeGreaterThan(0);
  });
  it('flies the footprint that is drawn', () => {
    for (const g of landingGear) {
      expect(gearFootprintM(withGear(g.id))).toBe(GEAR[g.id].radius);
      expect(flightSetup(withGear(g.id)).lander?.legRadiusM).toBe(GEAR[g.id].radius);
    }
  });
  it('changes nothing else, and nothing at all without a gear choice', () => {
    const plain = flightSetup(mission()).lander!, wide = flightSetup(withGear('wide-four')).lander!;
    expect(plain).not.toHaveProperty('legRadiusM');
    expect({ ...wide, legRadiusM: undefined }).toEqual({ ...plain, legRadiusM: undefined });
    expect(flightSetup(withGear('unknown-gear')).lander).not.toHaveProperty('legRadiusM');
  });
});
