import { describe, expect, it } from 'vitest';
import { equipmentSettings, initialEquipment, landingGear, vehicles, sensors } from './equipmentCatalog';
import { antennaPackages, liveries, solarArrays } from '../../lib/landerAppearance';
import { defaultSettings, validateSettings } from '../../lib/mission';
describe('equipment handoff',()=>{
  it('keeps every prototype combination valid and carries the chosen gear into the settings',()=>{
    for(const vehicle of vehicles)for(const gear of landingGear)for(const sensor of sensors){
      const selection={vehicleId:vehicle.id,landingGearId:gear.id,hazardSensor:sensor.id};
      const settings=equipmentSettings(selection,{...defaultSettings,windSpeedMs:8,environment:'earth'});
      expect(validateSettings(settings)).toEqual([]);expect(settings.windSpeedMs).toBe(8);expect(settings.environment).toBe('earth');expect(settings.hazardSensor).toBe(sensor.id);
      expect(settings.landingGearId).toBe(gear.id);expect(settings.dryMassKg).toBe(vehicle.settings.dryMassKg);
      // the gear changes only the gear settings and the slope guidance avoids
      const other=equipmentSettings({...selection,landingGearId:landingGear[0].id},{...defaultSettings,windSpeedMs:8,environment:'earth'});
      const strip=({landingGearId,gearStrokeM,gearDampingRatio,maxSlopeToleranceDeg,...rest}:typeof settings)=>rest;
      expect(strip(settings)).toEqual(strip(other));
    }
  });
  it('keeps appearance choices out of physical settings',()=>{
    const baseline=equipmentSettings(initialEquipment,defaultSettings);
    for(const livery of liveries)for(const solar of solarArrays)for(const antenna of antennaPackages){
      expect(equipmentSettings({...initialEquipment,liveryId:livery.id,solarArrayId:solar.id,antennaId:antenna.id},defaultSettings)).toEqual(baseline);
    }
  });
  it('rejects stale or unknown equipment identifiers',()=>{
    expect(()=>equipmentSettings({...initialEquipment,landingGearId:'missing'},defaultSettings)).toThrow('available equipment');
  });
});
