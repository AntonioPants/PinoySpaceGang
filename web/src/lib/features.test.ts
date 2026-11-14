import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveEnvironment, runSim } from '../../../app/sim/src/engine';
import type { EnvironmentProfile } from '../../../app/lib/environment.mjs';
import { analogs, catalogSites, targets, terrainScore } from '../data/sites';
import { buildMission, defaultSettings, extractProfile } from './mission';
import { toSimInput } from './simulation';
import { fidelityFor, stressFor } from './fidelity';
import { parseConditions, parseSettingsFile } from './importSettings';
import { WEATHER_PROFILE_ID, hasWeatherProfile, utmGridNorthBearingDeg } from './weather';
import type { TerrainManifest } from './types';

const root = new URL('../../../', import.meta.url);
function profileOf(id: string) {
  const base = new URL(`web/public${catalogSites.find(s => s.id === id)!.terrain!.manifest_url}`, root);
  const raw = JSON.parse(readFileSync(base, 'utf8'));
  const manifest: TerrainManifest = { ...raw, source: { ...raw.source, sha256: raw.source.sha256 ?? raw.source.subset_sha256 } };
  const bytes = readFileSync(new URL(manifest.grid.sample_file, base));
  return extractProfile(manifest, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}
const weatherOf = (id: string): EnvironmentProfile => JSON.parse(readFileSync(new URL(`data/environment/${WEATHER_PROFILE_ID[id]}.json`, root), 'utf8'));
const target = (id: string) => targets.find(t => t.id === id)!;

describe('sensor choice and interference source', () => {
  it('derives dust and glare from site data by default, and uses manual values on request', () => {
    const profile = profileOf('kilbourne-hole-v1');
    const site = toSimInput(buildMission(target('shackleton-rim'), profile, defaultSettings), profile);
    expect(site.interference).toBeUndefined(); // the engine derives it from the catalog surface data
    expect(site.sensors).toEqual({ hazard: 'lidar', velocimeter: true });
    const manual = toSimInput(buildMission(target('shackleton-rim'), profile, { ...defaultSettings, hazardSensor: 'camera', siteConditions: false, glare: 0.8 }), profile);
    expect(manual.sensors).toEqual({ hazard: 'camera', velocimeter: true });
    expect(manual.interference).toEqual({ dust: 0, glare: 0.8 });
    expect(runSim(site).environment.interference.dust).toBeGreaterThan(0); // basalt, from the catalog
  });
  it('round-trips the new settings through mission export and import', () => {
    const profile = profileOf('kilbourne-hole-v1');
    const mission = buildMission(target('shackleton-rim'), profile, { ...defaultSettings, hazardSensor: 'none', siteConditions: false, dust: 0.3 },
      { terrainScore: terrainScore('shackleton-rim', 'kilbourne-hole-v1') });
    expect(mission.evidence).toMatchObject({ quantitativeSimilarityScore: terrainScore('shackleton-rim', 'kilbourne-hole-v1'), status: 'proposed-pair' });
    expect(parseSettingsFile(JSON.stringify(mission), defaultSettings).settings).toMatchObject({ hazardSensor: 'none', siteConditions: false, dust: 0.3 });
  });
  it('reads a sensor from typed conditions and treats an explicit dust value as manual', () => {
    expect(parseConditions('camera, dust 40 %', defaultSettings).settings).toMatchObject({ hazardSensor: 'camera', siteConditions: false, dust: 0.4 });
  });
  it('has no terrain score for a pairing the catalog does not propose', () => {
    expect(terrainScore('jezero', 'kilbourne-hole-v1')).toBeNull();
    expect(buildMission(target('jezero'), profileOf('kilbourne-hole-v1'), defaultSettings).evidence.status).toBe('unvalidated-pair');
  });
});

describe('analog fidelity in the report', () => {
  it('scores a proposed pairing with the configured vehicle on both terrains', () => {
    const analogProfile = profileOf('craters-moon');
    const score = terrainScore('marius-hills', 'craters-moon');
    const mission = buildMission(target('marius-hills'), analogProfile, defaultSettings, { terrainScore: score });
    const result = fidelityFor(mission, analogProfile, profileOf('marius-hills'));
    expect(result.gravity).toBe(1.62);
    expect(result.score).toBeGreaterThanOrEqual(0); expect(result.score).toBeLessThanOrEqual(100);
    expect(result.catalogTerrainScore).toBe(score);
    expect(result.planetary.outcomes).toHaveLength(3); expect(result.analog.siteId).toBe('craters-moon');
  });
  it('compares under the planetary scenario even when the flown mission was an Earth field test', () => {
    const analogProfile = profileOf('capitol-reef');
    const mission = buildMission(target('jezero'), analogProfile, { ...defaultSettings, environment: 'earth' });
    const result = fidelityFor(mission, analogProfile, profileOf('jezero'));
    expect(result.gravity).toBe(3.72); expect(result.airDensity).toBe(0.02);
  });
});

describe('stress test in the report', () => {
  it('separates a rugged analog from a gentle one for the same target, using terrain data only', () => {
    const planet = profileOf('arsia-flank');
    const score = (analogId: string) => {
      const profile = profileOf(analogId);
      return stressFor(buildMission(target('arsia-flank'), profile, defaultSettings, { terrainScore: terrainScore('arsia-flank', analogId) }), profile, planet);
    };
    const gentle = score('amboy'), rugged = score('craters-moon');
    expect(gentle.assumedRockAbundance).toBe(0);
    expect(rugged.analog.successRate).toBeLessThan(gentle.analog.successRate);
    expect(rugged.score).toBeLessThan(gentle.score - 10);
  });
});

describe('real weather for Earth field tests', () => {
  const earth = { ...defaultSettings, environment: 'earth' as const, realWeatherMonth: 7, weatherScenario: 'high_wind' as const, windSpeedMs: 20 };
  it('maps every weather profile to an available catalog analog at the same place', () => {
    for (const [catalogId, weatherId] of Object.entries(WEATHER_PROFILE_ID)) {
      const entry = catalogSites.find(s => s.id === catalogId)!, site = weatherOf(catalogId).site;
      expect(analogs.find(a => a.id === catalogId)?.available).toBe(true);
      expect(site.id).toBe(weatherId);
      expect(Math.abs(entry.latitude - site.latitude)).toBeLessThan(0.1);
      expect(Math.abs(entry.longitude - site.longitude)).toBeLessThan(0.1);
    }
    expect(hasWeatherProfile('capitol-reef')).toBe(false);
  });
  it('matches the published UTM meridian convergence for Kilbourne Hole', () => {
    expect(utmGridNorthBearingDeg(31.972, -106.969)).toBeCloseTo(-1.042894636235898, 3);
  });
  it('flies the real modelled hour: wind vector and air density replace the manual values', () => {
    const profile = profileOf('kilbourne-hole-v1'), weather = weatherOf('kilbourne-hole-v1');
    const mission = buildMission(target('shackleton-rim'), profile, earth, { weatherAvailable: true });
    expect(mission.environment.realWeather).toEqual({ month: 7, scenario: 'high_wind' });
    const input = toSimInput(mission, profile, catalogSites.find(s => s.id === profile.manifest.id), weather);
    const hour = weather.months['7'].scenarios.high_wind!;
    expect(Math.hypot(input.site.wind!.x, input.site.wind!.y)).toBeCloseTo(hour.wind_speed_m_s, 2);
    expect(input.site.wind!.x).toBeCloseTo(hour.wind_east_m_s, 0); // rotated by only ~1° onto the UTM grid
    expect(resolveEnvironment(input)).toEqual({ gravity: 9.81, airDensity: hour.air_density_kg_m3, body: 'earth' });
    expect(input.site.sources!.wind).toContain(hour.timestamp_utc);
    expect(runSim(input).environment.wind).toEqual(input.site.wind);
  });
  it('never applies Earth weather to a planetary scenario or to a site without a profile', () => {
    const profile = profileOf('kilbourne-hole-v1');
    expect(buildMission(target('shackleton-rim'), profile, { ...earth, environment: 'planetary' }, { weatherAvailable: true }).environment.realWeather).toBeNull();
    expect(buildMission(target('shackleton-rim'), profile, earth, { weatherAvailable: false }).environment.realWeather).toBeNull();
  });
  it('refuses to fly a real-weather mission when the profile is missing', () => {
    const profile = profileOf('kilbourne-hole-v1');
    const mission = buildMission(target('shackleton-rim'), profile, earth, { weatherAvailable: true });
    expect(() => toSimInput(mission, profile, undefined, null)).toThrow('weather profile');
  });
});
