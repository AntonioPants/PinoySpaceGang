import { describe, expect, it } from 'vitest';
import { equipmentLoadouts } from './equipment';
import { defaultSettings, validateSettings } from '../lib/mission';
import { equipmentSettings, initialEquipment } from './opening/equipmentCatalog';

const G0 = 9.80665;
describe('real landers', () => {
  it('can each hover where they flew: thrust-to-weight above 1 at their own body', () => {
    for (const l of equipmentLoadouts.filter(l => l.history)) {
      const g = l.history!.includes('Mars') ? 3.71 : 1.62, s = l.settings;
      expect(s.thrusterForceN! / ((s.dryMassKg! + s.fuelMassKg!) * g), l.id).toBeGreaterThan(1.05);
      expect(validateSettings({ ...defaultSettings, ...s }), l.id).toEqual([]);
    }
  });
  it('carry delta-v from the rocket equation that matches a powered descent (tens to hundreds of m/s)', () => {
    for (const l of equipmentLoadouts.filter(l => l.history)) {
      const s = l.settings, dv = s.ispS! * G0 * Math.log((s.dryMassKg! + s.fuelMassKg!) / s.dryMassKg!);
      expect(dv, l.id).toBeGreaterThan(150); expect(dv, l.id).toBeLessThan(1000);
    }
  });
  it('a prototype chosen after a real lander drops the real engine figures', () => {
    const apollo = equipmentSettings({ ...initialEquipment, vehicleId: 'apollo-lm' }, defaultSettings);
    expect(apollo.ispS).toBe(311);
    const survey = equipmentSettings({ ...initialEquipment, vehicleId: 'survey' }, apollo);
    expect(survey.ispS).toBeUndefined(); expect(survey.minThrottle).toBeUndefined();
  });
});
