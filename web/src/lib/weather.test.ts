import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveEnvironment, runSim } from '../../../app/sim/src/engine';
import type { EnvironmentProfile } from '../../../app/lib/environment.mjs';
import { parseCatalog } from './catalog';
import { buildMission, defaultSettings, extractProfile } from './mission';
import { toSimInput } from './simulation';
import { WEATHER_PROFILE_ID, utmGridNorthBearingDeg } from './weather';
import type { TerrainManifest } from './types';

const root = new URL('../../../', import.meta.url);
const catalog = parseCatalog(JSON.parse(readFileSync(new URL('web/public/sites.json', root), 'utf8')));
const weatherOf = (id: string): EnvironmentProfile => JSON.parse(readFileSync(new URL(`data/environment/${WEATHER_PROFILE_ID[id]}.json`, root), 'utf8'));
function profileOf(id: string) {
  const base = new URL(`web/public${catalog.entries.get(id)!.terrain!.manifest_url}`, root);
  const manifest: TerrainManifest = JSON.parse(readFileSync(base, 'utf8'));
  const bytes = readFileSync(new URL(manifest.grid.sample_file, base));
  return extractProfile(manifest, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}
const target = catalog.targets.find(t => t.id === 'shackleton-rim')!;
const earth = { ...defaultSettings, environment: 'earth' as const, realWeatherMonth: 7, weatherScenario: 'high_wind' as const, windSpeedMs: 20 };

describe('real weather for Earth field tests', () => {
  it('maps every weather profile to a catalog site at the same place', () => {
    for (const [catalogId, weatherId] of Object.entries(WEATHER_PROFILE_ID)) {
      const entry = catalog.entries.get(catalogId)!, site = weatherOf(catalogId).site;
      expect(site.id).toBe(weatherId);
      expect(Math.abs(entry.latitude - site.latitude)).toBeLessThan(0.1);
      expect(Math.abs(entry.longitude - site.longitude)).toBeLessThan(0.1);
    }
  });
  it('matches the published UTM meridian convergence for Kilbourne Hole', () => {
    expect(utmGridNorthBearingDeg(31.972, -106.969)).toBeCloseTo(-1.042894636235898, 3);
  });
  it('flies the real modelled hour: wind vector and air density replace the manual values', () => {
    const profile = profileOf('kilbourne-hole-v1'), weather = weatherOf('kilbourne-hole-v1');
    const mission = buildMission(target, profile, earth, { weatherAvailable: true });
    expect(mission.environment.realWeather).toEqual({ month: 7, scenario: 'high_wind' });
    const input = toSimInput(mission, profile, catalog.entries.get('kilbourne-hole-v1'), weather);
    const hour = weather.months['7'].scenarios.high_wind!;
    expect(Math.hypot(input.site.wind!.x, input.site.wind!.y)).toBeCloseTo(hour.wind_speed_m_s, 2);
    expect(input.site.wind!.x).toBeCloseTo(hour.wind_east_m_s, 0); // rotated by only ~1° onto the UTM grid
    expect(resolveEnvironment(input)).toEqual({ gravity: 9.81, airDensity: hour.air_density_kg_m3, body: 'earth' });
    expect(input.site.sources!.wind).toContain(hour.timestamp_utc);
    expect(runSim(input).environment.wind).toEqual(input.site.wind);
  });
  it('never applies Earth weather to a planetary scenario or to a site without a profile', () => {
    const profile = profileOf('kilbourne-hole-v1');
    expect(buildMission(target, profile, { ...earth, environment: 'planetary' }, { weatherAvailable: true }).environment.realWeather).toBeNull();
    expect(buildMission(target, profile, earth, { weatherAvailable: false }).environment.realWeather).toBeNull();
  });
  it('refuses to fly a real-weather mission when the profile is missing', () => {
    const profile = profileOf('kilbourne-hole-v1');
    const mission = buildMission(target, profile, earth, { weatherAvailable: true });
    expect(() => toSimInput(mission, profile, catalog.entries.get('kilbourne-hole-v1'), null)).toThrow('weather profile');
  });
});
