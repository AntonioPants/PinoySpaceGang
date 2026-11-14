import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { analogs, targets } from '../data/sites';
import { buildMission, defaultSettings, extractProfile, loadProfile } from './mission';
import { toSimInput } from './simulation';
import { runSim } from '../../../app/sim/src/engine';

afterEach(() => vi.unstubAllGlobals());
const terrainSites = analogs.filter(s => s.available);
function localFetch() {
  vi.stubGlobal('fetch', async (url: string) => {
    const bytes = readFileSync(new URL(`../../public${url}`, import.meta.url));
    return new Response(bytes);
  });
}
describe('shared catalog through the mission journey', () => {
  it.each(terrainSites)('loads, exports and simulates $name with its own terrain', async site => {
    localFetch();
    const profile = await loadProfile(undefined, site.manifestUrl, site.id);
    const target = targets.find(t => site.matches.includes(t.id))!;
    expect(target).toBeDefined();
    expect(profile.manifest.grid.width_m).toBe(4800);
    expect(profile.manifest.statistics.relief_m).toBeGreaterThan(0);
    expect(profile.manifest.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    const mission = buildMission(target, profile, defaultSettings);
    expect(mission.earthAnalog.id).toBe(site.id);
    expect(mission.earthAnalog.terrainBaseUrl).toBe(site.manifestUrl!.replace('manifest.json', ''));
    const input = toSimInput(mission, profile);
    expect(input.site.id).toBe(site.id);
    expect(input.site.sources?.soilType).toBeDefined();
    const flight = runSim(input);
    expect(flight.summary).toBeDefined();
    expect(Number.isFinite(flight.summary!.verticalSpeedMps)).toBe(true);
    expect(flight.samples.length).toBeGreaterThan(10);
    expect(flight.samples.every(p => Math.abs(p.x) <= 2400 && Math.abs(p.y) <= 2400)).toBe(true);
  });
  it('rejects a pack served for the wrong location', async () => {
    localFetch();
    await expect(loadProfile(undefined, analogs[0].manifestUrl, 'meteor-crater')).rejects.toThrow('match');
  });
  it('rejects nonfinite samples outside the centre-row chart', async () => {
    localFetch();
    const profile = await loadProfile();
    new DataView(profile.buffer).setFloat32(0, NaN, true);
    expect(() => extractProfile(profile.manifest, profile.buffer)).toThrow('missing');
  });
  it('prevents a stale mission from running on a newly selected pack', async () => {
    localFetch();
    const profile = await loadProfile();
    const mission = buildMission(targets[0], profile, defaultSettings);
    mission.earthAnalog.id = 'meteor-crater';
    expect(() => toSimInput(mission, profile)).toThrow('match');
  });
});
