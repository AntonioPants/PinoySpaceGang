import { describe, expect, it } from 'vitest';
import { buildMission, defaultSettings, extractProfile, validateSettings } from './mission';
import { targets } from '../data/sites';
import type { TerrainManifest } from './types';
import manifestJson from '../../public/terrain/kilbourne-hole-v1/manifest.json';
const manifest: TerrainManifest = { ...manifestJson, grid: { ...manifestJson.grid, rows: 3, columns: 3 }, local_frame: { vertical_offset_m: 100 } };
function fixture() {
  const buffer = new ArrayBuffer(36), view = new DataView(buffer);
  [100, 101, 102, 110, 120, 130, 140, 150, 160].forEach((v, i) => view.setFloat32(i * 4, v, true));
  return { buffer, profile: extractProfile(manifest, buffer) };
}
describe('terrain to mission handoff', () => {
  it('extracts the west-to-east centre row and subtracts the vertical origin exactly once', () => {
    const { profile } = fixture(); expect(profile.heightsM).toEqual([10, 20, 30]);
    expect(profile.sampleSpacingM).toBe(30); expect(profile.row).toBe(1);
  });
  it('rejects truncated downloads, nonfinite data, and unsupported units/layout', () => {
    expect(() => extractProfile(manifest, new ArrayBuffer(4))).toThrow('size');
    const { buffer } = fixture(); new DataView(buffer).setFloat32(16, NaN, true);
    expect(() => extractProfile(manifest, buffer)).toThrow('missing');
    expect(() => extractProfile({ ...manifest, grid: { ...manifest.grid, spacing_m: 0 } }, buffer)).toThrow('metadata');
  });
  it('exports lunar vacuum with no wind while retaining provenance and unknown scores', () => {
    const mission = buildMission(targets[0], fixture().profile, { ...defaultSettings, windSpeedMs: 12 });
    expect(mission.environment).toEqual({ mode: 'planetary', gravityMs2: 1.62, windSpeedMs: 0, atmosphereModel: 'none', dust: 0, glare: 0, interferenceSource: 'site' });
    expect(mission.earthAnalog.sourceSha256).toBe(manifest.source.sha256);
    expect(mission.earthAnalog.elevationProfile).toEqual([10, 20, 30]);
    expect(mission.evidence.quantitativeSimilarityScore).toBeNull();
  });
  it('keeps Earth conditions distinct from target-body gravity', () => {
    const mission = buildMission(targets[0], fixture().profile, { ...defaultSettings, environment: 'earth', windSpeedMs: 12 });
    expect(mission.environment.gravityMs2).toBe(9.81); expect(mission.environment.windSpeedMs).toBe(12);
    expect(mission.planetaryTarget.gravity).toBe(1.62);
  });
  it('labels the simplified constant Mars atmosphere explicitly', () => {
    const mission = buildMission(targets[2], fixture().profile, defaultSettings);
    expect(mission.environment.atmosphereModel).toBe('mars-constant');
    expect(mission.environment.gravityMs2).toBe(3.72);
  });
  it('rejects invalid restored or exported settings', () => {
    expect(validateSettings({ ...defaultSettings, fuelMassKg: NaN })).not.toHaveLength(0);
    expect(() => buildMission(targets[0], fixture().profile, { ...defaultSettings, dryMassKg: -1 })).toThrow('dryMassKg');
  });
});
