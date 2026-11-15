import { describe, expect, it } from 'vitest';
import { GEAR } from '../components/cutscene/lander';
import { landingGear, equipmentSettings, initialEquipment } from '../game/opening/equipmentCatalog';
import { GEAR_PRESETS, gearDetail, gearFootprintM, gearFromSettings, gearStats, validateGearSettings, withGear, type GearPresetId } from './gear';
import { buildMission, defaultSettings, extractProfile, validateSettings } from './mission';
import { flightSetup } from './simulation';
import { gearRows } from './debrief';
import { targets } from '../data/sites';
import { createSim, syntheticTerrain } from '../../../app/sim/src/index';
import type { MissionConfig, TerrainManifest } from './types';
import manifestJson from '../../public/terrain/kilbourne-hole-v1/manifest.json';

const mission = (equipment?: MissionConfig['equipment']) => ({
  planetaryTarget: { body: 'Moon' }, strategy: { mode: 'AUTONOMOUS_HAZARD_AVOID', dryMassKg: 800, fuelMassKg: 350, thrusterForceN: 12000, maxSlopeToleranceDeg: 12, hazardSensor: 'lidar' },
  environment: { interferenceSource: 'site', dust: 0, glare: 0 }, equipment,
}) as unknown as MissionConfig;
const named = (landingGearId: string) => mission({ vehicleId: 'v', landingGearId, hazardSensor: 'lidar', gearPhysics: 'footprint' });
const manifest: TerrainManifest = { ...manifestJson, grid: { ...manifestJson.grid, rows: 3, columns: 3 }, local_frame: { vertical_offset_m: 0 } };
const profile = extractProfile(manifest, new Float32Array(9).fill(5).buffer);
const ids = Object.keys(GEAR_PRESETS) as GearPresetId[];

describe('landing gear presets', () => {
  it('every gear the player can pick is a simulated preset, drawn with the stance it flies', () => {
    expect(landingGear.map(g => g.id).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const drawn = GEAR[id], flown = GEAR_PRESETS[id];
      expect({ legs: drawn.legs, radius: drawn.radius, pad: drawn.pad }).toEqual({ legs: flown.legs, radius: flown.radiusM, pad: flown.padRadiusM });
    }
  });
  it('carries the baseline figures: stroke, mass and slope rating', () => {
    expect(GEAR_PRESETS['standard-four']).toMatchObject({ legs: 4, radiusM: 3.0, strokeM: 0.45, gearMassKg: 75, slopeRatingDeg: 12 });
    expect(GEAR_PRESETS['wide-four']).toMatchObject({ legs: 4, radiusM: 3.8, strokeM: 0.4, gearMassKg: 110, slopeRatingDeg: 16 });
    expect(GEAR_PRESETS['survey-six']).toMatchObject({ legs: 6, radiusM: 3.3, strokeM: 0.6, gearMassKg: 135 });
    expect(gearDetail('standard-four')).toBe('4 legs · 0.45 m stroke · 75 kg · rated 12° slope');
    for (const g of landingGear) expect(g.detail).toBe(gearDetail(g.id));
  });
  it('gives each gear a different job: wide holds slopes, survey absorbs impacts and rough ground', () => {
    const [standard, wide, survey] = (['standard-four', 'wide-four', 'survey-six'] as const).map(id => gearStats(gearFromSettings(withGear(defaultSettings, id))!, 1.62));
    expect(wide.holdsSlopeDeg).toBeGreaterThan(standard.holdsSlopeDeg + 3);
    expect(wide.staticTipDeg).toBeGreaterThan(standard.staticTipDeg);
    expect(survey.maxSinkMps).toBeGreaterThan(standard.maxSinkMps);
    expect(survey.roughnessToleranceM).toBeGreaterThan(standard.roughnessToleranceM);
    expect(wide.maxSinkMps).toBeLessThan(standard.maxSinkMps);
    // lower gravity tips sooner
    expect(gearStats(gearFromSettings(withGear(defaultSettings, 'standard-four'))!, 9.81).holdsSlopeDeg).toBeGreaterThan(standard.holdsSlopeDeg);
  });
});

describe('landing gear in the settings', () => {
  it('fitting a gear sets its stroke, damping and slope rating; trimming makes it custom', () => {
    const fitted = withGear(defaultSettings, 'wide-four');
    expect(fitted).toMatchObject({ landingGearId: 'wide-four', gearStrokeM: 0.4, maxSlopeToleranceDeg: 16 });
    expect(validateSettings(fitted)).toEqual([]);
    expect(gearFromSettings(fitted)).toMatchObject({ gearId: 'wide-four', legs: 4, radiusM: 3.8, strokeM: 0.4, gearMassKg: 110 });
    expect(gearFromSettings({ ...fitted, gearStrokeM: 0.7 })).toMatchObject({ gearId: 'custom', strokeM: 0.7, radiusM: 3.8 });
    expect(gearFromSettings(defaultSettings)).toBeUndefined();
  });
  it('rejects an unknown gear and a trim outside its range', () => {
    expect(validateGearSettings({ ...defaultSettings, landingGearId: 'tripod' })).toEqual(['Unknown landing gear.']);
    expect(validateSettings({ ...withGear(defaultSettings, 'standard-four'), gearStrokeM: 2 })).toEqual(['gearStrokeM is outside its supported range.']);
    expect(validateSettings({ ...withGear(defaultSettings, 'standard-four'), gearDampingRatio: 0 })).toEqual(['gearDampingRatio is outside its supported range.']);
  });
  it('the equipment bay fits the chosen gear, and keeps a trim while the same gear stays on', () => {
    const first = equipmentSettings({ ...initialEquipment, landingGearId: 'survey-six' }, defaultSettings);
    expect(first).toMatchObject({ landingGearId: 'survey-six', gearStrokeM: 0.6, maxSlopeToleranceDeg: 14 });
    const trimmed = { ...first, gearStrokeM: 0.8, gearDampingRatio: 0.9 };
    expect(equipmentSettings({ ...initialEquipment, landingGearId: 'survey-six' }, trimmed)).toMatchObject({ gearStrokeM: 0.8, gearDampingRatio: 0.9 });
    expect(equipmentSettings({ ...initialEquipment, landingGearId: 'wide-four' }, trimmed)).toMatchObject({ landingGearId: 'wide-four', gearStrokeM: 0.4, gearDampingRatio: 0.7 });
  });
});

describe('landing gear in the physics', () => {
  it('the mission carries the resolved gear and the simulation flies it', () => {
    const config = buildMission(targets[0], profile, { ...withGear(defaultSettings, 'survey-six'), gearStrokeM: 0.7 });
    expect(config.strategy.landingGear).toMatchObject({ gearId: 'custom', legs: 6, radiusM: 3.3, strokeM: 0.7, gearMassKg: 135 });
    expect(config.strategy.dryMassKg).toBe(defaultSettings.dryMassKg);          // the vehicle alone
    const lander = flightSetup(config).lander!;
    expect(lander.gear).toEqual(config.strategy.landingGear);
    expect(lander).not.toHaveProperty('legRadiusM');                            // the gear sets it in the engine
    const sim = createSim({ site: syntheticTerrain({ hillsM: 0 }), strategy: 'manual', lander });
    expect(sim.lander.legRadiusM).toBe(3.3);
    expect(sim.lander.dryMassKg).toBe(defaultSettings.dryMassKg + 135);
    expect(sim.lander.limits.maxVerticalMps).toBeCloseTo(Math.sqrt(2 * 15 * 0.7 * 0.7), 2);
    expect(sim.lander.limits.maxSlopeDeg).toBe(14);                             // what guidance avoids
  });
  it('a mission without a gear model is unchanged: fixed limits, and a named gear still flies its footprint', () => {
    expect(buildMission(targets[0], profile, defaultSettings).strategy).not.toHaveProperty('landingGear');
    const plain = flightSetup(mission()).lander!, wide = flightSetup(named('wide-four')).lander!;
    expect(plain).not.toHaveProperty('legRadiusM'); expect(plain).not.toHaveProperty('gear');
    expect(gearFootprintM(named('wide-four'))).toBe(GEAR['wide-four'].radius);
    expect(wide.legRadiusM).toBe(GEAR['wide-four'].radius);
    expect({ ...wide, legRadiusM: undefined }).toEqual({ ...plain, legRadiusM: undefined });
    expect(flightSetup(named('unknown-gear')).lander).not.toHaveProperty('legRadiusM');
  });
  it('reports the gear in the debrief: stroke used and tip margin', () => {
    const drop = (vz: number) => {
      const config = buildMission(targets[0], profile, withGear(defaultSettings, 'standard-four'));
      const sim = createSim({ site: syntheticTerrain({ hillsM: 0 }), strategy: 'manual', lander: flightSetup(config).lander, start: { position: { x: 0, y: 0, z: 0.3 }, velocity: { x: 0, y: 0, z: vz } } });
      while (!sim.state.done) sim.step({ throttle: 0, tiltX: 0, tiltY: 0 });
      return gearRows(sim.telemetry());
    };
    const soft = drop(-2);
    expect(soft[0][0]).toBe('Shock compression');
    expect(soft[0][1]).toMatch(/^0\.\d\d m of 0\.45 m \(\d+% of stroke\)$/);
    expect(soft[1][1]).toMatch(/^\d+\.\d° from overturn/);
    expect(drop(-4)[0][1]).toMatch(/bottomed out/);
    expect(gearRows({ summary: { outcome: 'success' } } as never)).toEqual([]);
  });
});
