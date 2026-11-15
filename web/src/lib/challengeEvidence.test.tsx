import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it} from 'vitest';
import raw from '../../public/sites.json';
import {parseCatalog,scoreLabel,analogScoreFor,analogsFor,recommendedAnalogs} from './catalog';
import AnalogEvidence from '../components/AnalogEvidence';
import {isBaselineMission} from './landingSimilarity';
import {buildMission,defaultSettings,extractProfile} from './mission';
import type {TerrainManifest} from './types';
const catalog=parseCatalog(raw);
const publicRoot=new URL('../../public/',import.meta.url);
it('shows modern percentages for every top ten and all 102 Earth sites for every target',()=>{
  for(const target of catalog.targets){
    expect(recommendedAnalogs(catalog,target.id)).toHaveLength(10);
    const all=analogsFor(catalog,target.id);
    expect(all).toHaveLength(102);
    for(const site of all){expect(analogScoreFor(catalog,target.id,site.id)).toBeTypeOf('number');expect(scoreLabel(catalog,target.id,site.id)).toMatch(/% analog match$/);}
  }
});
it('renders reviewed matches, differences, supporting source and explicit limits',()=>{
  const html=renderToStaticMarkup(<AnalogEvidence catalog={catalog} targetId="shackleton-rim" earthId="kilbourne-hole-v1"/>);
  for(const text of ['Why it matches','Where the analogy breaks down','Supporting source','What Earth cannot reproduce','not validated accuracy','9.81'])expect(html).toContain(text);
  const pair=catalog.pairings.find(p=>p.planetary_id==='shackleton-rim'&&p.earth_id==='kilbourne-hole-v1')!;
  expect(html).toContain(pair.explanation!.matches[0].slice(0,25));
});
it('does not invent a geological explanation for scanned windows',()=>{
  const id=catalog.analogs.find(a=>a.id.startsWith('scan-'))!.id;
  const html=renderToStaticMarkup(<AnalogEvidence catalog={catalog} targetId="phoenix" earthId={id}/>);
  expect(html).toContain('local geology not reviewed');expect(html).toContain('geological analogy has not been reviewed');
});
it('covers every proposed and published top-ten pairing with a baseline from the exact catalog',()=>{
  const baseline=JSON.parse(readFileSync(new URL('landing-similarity.json',publicRoot),'utf8'));
  const keys=baseline.rows.map((r:{planetary_id:string;earth_id:string})=>`${r.planetary_id}/${r.earth_id}`);
  expect(new Set(keys).size).toBe(keys.length);
  for(const p of [...catalog.pairings,...catalog.matching!.comparisons])expect(keys).toContain(`${p.planetary_id}/${p.earth_id}`);
  expect(baseline.catalog_sha256).toBe(createHash('sha256').update(readFileSync(new URL('sites.json',publicRoot))).digest('hex'));
});
it('only reuses the baseline for the exact default scenario without gear or weather overrides',()=>{
  const entry=catalog.entries.get('kilbourne-hole-v1')!;
  const url=new URL(entry.terrain!.manifest_url.slice(1),publicRoot);
  const manifest:TerrainManifest=JSON.parse(readFileSync(url,'utf8'));
  const bytes=readFileSync(new URL(manifest.grid.sample_file,url));
  const profile=extractProfile(manifest,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const mission=buildMission(catalog.targets[0],profile,defaultSettings);
  expect(isBaselineMission(mission)).toBe(true);
  expect(isBaselineMission({...mission,strategy:{...mission.strategy,dryMassKg:900}})).toBe(false);
  expect(isBaselineMission({...mission,environment:{...mission.environment,windSpeedMs:2}})).toBe(false);
  expect(isBaselineMission({...mission,equipment:{vehicleId:'test',landingGearId:'standard-four',hazardSensor:'lidar',gearPhysics:'footprint'}})).toBe(false);
});
