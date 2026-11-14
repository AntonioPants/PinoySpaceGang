import { describe, expect, it } from 'vitest';
import { parseConditions, parseSettingsFile } from './importSettings';
import { defaultSettings } from './mission';
describe('condition import',()=>{
  it('maps explicit units without modifying the original settings',()=>{
    const p=parseConditions('Earth, manual, fuel 500 kg, thrust 20 kN, wind 12 m/s, dust 30%, glare 20%',defaultSettings);
    expect(p.settings).toMatchObject({environment:'earth',mode:'MANUAL_CONTROL',fuelMassKg:500,thrusterForceN:20000,windSpeedMs:12,dust:.3,glare:.2});
    expect(defaultSettings.fuelMassKg).toBe(350);
  });
  it('rejects ambiguous, duplicated, out-of-range or unsupported conditions',()=>{
    for(const input of ['very windy','wind 31 m/s','wind 2 m/s, wind 4 m/s','fuel 500','thrust -3 kN','dust 130%','fuel 500 kg, rain 10 mm']) expect(()=>parseConditions(input,defaultSettings)).toThrow();
  });
  it('imports partial settings and retains explicit existing values',()=>{
    const p=parseSettingsFile('{"schemaVersion":"1.0.0","targetId":"jezero_crater","settings":{"fuelMassKg":600}}',defaultSettings);
    expect(p.targetId).toBe('jezero'); expect(p.settings.fuelMassKg).toBe(600); expect(p.settings.thrusterForceN).toBe(defaultSettings.thrusterForceN);
  });
  it('rejects bad types, schema versions, unknown keys and unknown targets',()=>{
    for(const value of [[],null,{fuelMassKg:'500'},{fuelMassKg:-1},{schemaVersion:'2.0.0',fuelMassKg:500},{targetId:'unknown',fuelMassKg:500},{wind:12},{dust:2}]) expect(()=>parseSettingsFile(JSON.stringify(value),defaultSettings)).toThrow();
  });
});
