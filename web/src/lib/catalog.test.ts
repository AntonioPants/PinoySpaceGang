import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runSim } from '../../../app/sim/src/engine';
import { analogsFor, pairingOf, parseCatalog } from './catalog';
import { buildMission, defaultSettings, extractProfile } from './mission';
import { toSimInput } from './simulation';
import { fidelityFor } from './fidelity';
import { parseSettingsFile } from './importSettings';
import type { TerrainManifest } from './types';

const pub = new URL('../../public/', import.meta.url);
const catalog = parseCatalog(JSON.parse(readFileSync(new URL('sites.json', pub), 'utf8')));
function profileOf(id: string) {
  const base = new URL(catalog.entries.get(id)!.terrain!.manifest_url.replace(/^\//, ''), pub);
  const manifest: TerrainManifest = JSON.parse(readFileSync(base, 'utf8'));
  const bytes = readFileSync(new URL(manifest.grid.sample_file, base));
  return extractProfile(manifest, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}

describe('site catalog in the mission planner', () => {
  it('lists every planetary target and Earth analog from the catalog', () => {
    expect(catalog.targets.map(t => t.id).sort()).toEqual(['arsia-flank', 'bagnold', 'jezero', 'marius-hills', 'phoenix', 'shackleton-rim']);
    expect(catalog.targets.find(t => t.id === 'jezero')).toMatchObject({ body: 'Mars', gravity: 3.72 });
    expect(catalog.analogs.filter(a => a.available)).toHaveLength(11);
    expect(catalog.analogs.filter(a => !a.available)).toEqual([]);
  });
  it('orders analogs for a target by proposed pairing score', () => {
    const list = analogsFor(catalog, 'arsia-flank');
    expect(list[0].id).toBe('amboy');
    expect(pairingOf(catalog, 'arsia-flank', list[0].id)!.terrain_score).toBeGreaterThan(0.99);
    expect(pairingOf(catalog, 'arsia-flank', 'white-sands')).toBeUndefined();
    expect(list.at(-1)!.id).toBe('qaidam');
  });
  it('every available analog pack loads and flies with its catalog surface data', () => {
    const target = catalog.targets.find(t => t.id === 'marius-hills')!;
    for (const analog of catalog.analogs.filter(a => a.available)) {
      const profile = profileOf(analog.id);
      const mission = buildMission(target, profile, defaultSettings, { terrainBase: analog.terrainBase, analogName: analog.name });
      const input = toSimInput(mission, profile, catalog.entries.get(analog.id));
      expect(input.site.id).toBe(analog.id);
      expect(input.interference).toBeUndefined(); // derived from site data by the engine
      expect(input.site.sources?.soilType).toBeTruthy();
    }
  });
  it('carries the pairing score, sensor choice and interference source through export and import', () => {
    const target = catalog.targets.find(t => t.id === 'shackleton-rim')!;
    const profile = profileOf('kilbourne-hole-v1');
    const pairing = pairingOf(catalog, target.id, 'kilbourne-hole-v1')!;
    const mission = buildMission(target, profile, { ...defaultSettings, hazardSensor: 'camera', siteConditions: false, glare: 0.8 },
      { terrainScore: pairing.terrain_score });
    expect(mission.evidence).toMatchObject({ quantitativeSimilarityScore: pairing.terrain_score, status: 'proposed-pair' });
    const input = toSimInput(mission, profile, catalog.entries.get('kilbourne-hole-v1'));
    expect(input.sensors).toEqual({ hazard: 'camera', velocimeter: true });
    expect(input.interference).toEqual({ dust: 0, glare: 0.8 });
    const imported = parseSettingsFile(JSON.stringify(mission), defaultSettings, catalog.targets);
    expect(imported.targetId).toBe('shackleton-rim');
    expect(imported.settings).toMatchObject({ hazardSensor: 'camera', siteConditions: false, glare: 0.8 });
  });
  it('scores analog fidelity for a proposed pairing with the configured vehicle', () => {
    const target = catalog.targets.find(t => t.id === 'marius-hills')!;
    const analogProfile = profileOf('craters-moon');
    const pairing = pairingOf(catalog, target.id, 'craters-moon')!;
    const mission = buildMission(target, analogProfile, defaultSettings, { terrainScore: pairing.terrain_score });
    const result = fidelityFor(mission, analogProfile, profileOf('marius-hills'), catalog.entries.get('marius-hills')!, catalog.entries.get('craters-moon'));
    expect(result.gravity).toBe(1.62);
    expect(result.score).toBeGreaterThanOrEqual(0); expect(result.score).toBeLessThanOrEqual(100);
    expect(result.catalogTerrainScore).toBe(pairing.terrain_score);
    expect(result.planetary.outcomes).toHaveLength(3);
    // the flown descent itself still completes on this pairing
    expect(runSim(toSimInput(mission, analogProfile, catalog.entries.get('craters-moon'))).summary).toBeDefined();
  });
});
