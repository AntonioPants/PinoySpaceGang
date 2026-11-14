import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runSim, resolveEnvironment } from '../../../app/sim/src/engine';
import { buildMission, defaultSettings, extractProfile } from './mission';
import { toSimInput } from './simulation';
import { parseSettingsFile } from './importSettings';
import { targets } from '../data/sites';
import manifest from '../../public/terrain/kilbourne-hole-v1/manifest.json';
const bytes=readFileSync(new URL('../../public/terrain/kilbourne-hole-v1/elevation.f32',import.meta.url));
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
const profile=extractProfile(manifest,buffer);
describe('live physics integration',()=>{
  it('keeps full-grid absolute elevations and flips north/south exactly once',()=>{
    const input=toSimInput(buildMission(targets[0],profile,defaultSettings),profile);
    expect(input.site.heightmap.heights[0]).toBe(new DataView(buffer).getFloat32(160*161*4,true));
    expect(input.site.heightmap.cols).toBe(161); expect(input.site.heightmap.cellSize).toBe(30);
  });
  it('round-trips exported configuration into the importer',()=>{
    const mission=buildMission(targets[2],profile,{...defaultSettings,dust:.4});
    const imported=parseSettingsFile(JSON.stringify(mission),defaultSettings);
    expect(imported.targetId).toBe(targets[2].id); expect(imported.settings.dust).toBe(.4);
  });
  it('resolves native Earth and lunar vacuum separately',()=>{
    const earth=toSimInput(buildMission(targets[0],profile,{...defaultSettings,environment:'earth',windSpeedMs:10}),profile);
    expect(resolveEnvironment(earth)).toEqual({gravity:9.81,airDensity:1.225,body:'earth'});
    const moon=toSimInput(buildMission(targets[0],profile,{...defaultSettings,windSpeedMs:10}),profile);
    expect(resolveEnvironment(moon)).toEqual({gravity:1.62,airDensity:0,body:'moon'}); expect(moon.site.wind?.x).toBe(0);
  });
  it('completes a deterministic descent on the actual Kilbourne pack',()=>{
    const mission=buildMission(targets[0],profile,defaultSettings);
    const flight=runSim(toSimInput(mission,profile));
    expect(flight.summary).toBeDefined(); expect(flight.samples.length).toBeGreaterThan(10);
    expect(Number.isFinite(flight.summary!.verticalSpeedMps)).toBe(true);
    expect(flight.summary!.fuelRemainingKg).toBeGreaterThanOrEqual(0);
    expect(flight.summary!.flightTimeS).toBeLessThanOrEqual(300.01);
    expect(flight.samples.every(p=>Math.abs(p.x)<=2400&&Math.abs(p.y)<=2400)).toBe(true);
  });
});
