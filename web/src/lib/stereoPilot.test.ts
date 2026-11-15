import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseCatalog } from './catalog';
import { currentStereoPilot, type StereoPilot } from './stereoPilot';

const raw=(path:string)=>readFileSync(new URL(`../../public/${path}`,import.meta.url));
const catalog=parseCatalog(JSON.parse(raw('sites.json').toString()));
const report=JSON.parse(raw('terrain-pilot-comparison.json').toString());
describe('measured stereo pilot',()=>{
  it('binds both measured packs to unchanged catalog elevations and separate pilot bytes',()=>{
    expect(report.catalog_sha256).toBe(createHash('sha256').update(raw('sites.json')).digest('hex'));
    expect(Object.keys(report.pilots).sort()).toEqual(['apollo-16-descartes','phoenix']);
    for(const [id,value] of Object.entries(report.pilots)){
      const pilot=value as StereoPilot;
      expect(currentStereoPilot(catalog,id,pilot)).toBe(true);
      expect(pilot.output_spacing_m).toBe(30);
      const path=pilot.manifest_url.replace(/manifest.json$/,'elevation.f32');
      expect(createHash('sha256').update(raw(path.slice(1))).digest('hex')).toBe(pilot.pilot_elevation_sha256);
      expect(catalog.entries.get(id)?.terrain?.manifest_url).toBe(`/terrain/${id}/manifest.json`);
      expect(pilot.candidates).toHaveProperty('badwater');
    }
  });
  it('rejects a stale source, missing coverage or mismatched preview identity',()=>{
    const pilot=report.pilots.phoenix as StereoPilot;
    expect(currentStereoPilot(catalog,'phoenix',{...pilot,catalog_elevation_sha256:'stale'})).toBe(false);
    expect(currentStereoPilot(catalog,'phoenix',{...pilot,minimum_cell_valid_fraction:.99})).toBe(false);
    expect(currentStereoPilot(catalog,'jezero',pilot)).toBe(false);
    expect(currentStereoPilot(catalog,'phoenix',{...pilot,manifest_url:'/terrain-pilots/jezero/manifest.json'})).toBe(false);
    const altered={...catalog,entries:new Map(catalog.entries)};
    const other=altered.entries.get('amboy')!;
    altered.entries.set('amboy',{...other,terrain:{...other.terrain!,elevation_sha256:'changed'}});
    expect(currentStereoPilot(altered,'phoenix',pilot)).toBe(false);
  });
});
