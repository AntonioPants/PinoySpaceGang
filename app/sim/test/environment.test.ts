import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEarthLandingInput } from '../../lib/environment-site.ts';
import type { EnvironmentProfile } from '../../lib/environment.mjs';
import { terrainPackToSite, resolveEnvironment, runSim } from '../src/index.ts';

const root = new URL('../../../', import.meta.url);
const profile: EnvironmentProfile = JSON.parse(readFileSync(new URL('data/environment/kilbourne_hole.json', root), 'utf8'));
const pack = new URL('web/public/terrain/kilbourne-hole-v1/', root);
function terrain() {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', pack), 'utf8'));
  const bytes = readFileSync(new URL('elevation.f32', pack));
  return terrainPackToSite(manifest, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { analogOf: 'moon' });
}

describe('Earth environment data contract', () => {
  it('runs real Kilbourne geometry with real seasonal weather in Earth mode', () => {
    const original = terrain();
    const { input, environment } = createEarthLandingInput(original, profile, { month: 7 }, { gridNorthBearingDeg: -1.042894636235898 });
    const resolved = resolveEnvironment(input);
    expect(resolved.body).toBe('earth');
    expect(resolved.airDensity).toBe(environment.weather.air_density_kg_m3);
    expect(resolved.gravity).toBeGreaterThan(9);
    expect(input.site.heightmap).toBe(original.heightmap);
    expect(original.wind).toBeUndefined();
    expect(input.site.albedo).toBeUndefined(); // Regional albedo must be explicitly chosen.
    const result = runSim(input);
    expect(result.summary).toBeDefined();
    expect(result.samples.every(s => Number.isFinite(s.z))).toBe(true);
  });
  it('rotates geographic wind into grid coordinates without using Y-up preview axes', () => {
    const p = structuredClone(profile);
    Object.assign(p.months['1'].scenarios.typical!, { wind_east_m_s: 0, wind_north_m_s: -10, wind_speed_m_s: 10, wind_from_deg: 0 });
    const { input } = createEarthLandingInput(terrain(), p, { month: 1 }, { gridNorthBearingDeg: 90 });
    expect(input.site.wind!.x).toBeCloseTo(10);
    expect(input.site.wind!.y).toBeCloseTo(0);
  });
  it('rejects mixed bodies/sites and makes regional albedo an explicit opt-in', () => {
    expect(() => createEarthLandingInput({ ...terrain(), body: 'mars' }, profile, { month: 1 }, { gridNorthBearingDeg: 0 })).toThrow('Earth terrain');
    expect(() => createEarthLandingInput({ ...terrain(), id: 'badwater_basin' }, profile, { month: 1 }, { gridNorthBearingDeg: 0 })).toThrow('IDs');
    const { input } = createEarthLandingInput(terrain(), profile, { season: 'JJA' }, { gridNorthBearingDeg: 0, useRegionalAlbedo: true });
    expect(input.site.albedo).toBe(profile.seasons.JJA.radiation.albedo.mean);
  });
});
