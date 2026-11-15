/** Offline baseline. Run: npx tsx app/sim/scripts/landing-similarity.ts --out data/staged/landing-similarity.json */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { stressFidelity } from '../src/fidelity.ts';
import { readCatalog, loadCatalogSite } from './catalog-node.ts';

const catalog = readCatalog();
const raw = JSON.parse(readFileSync(new URL('../../../web/public/sites.json', import.meta.url), 'utf8'));
const bestScans = catalog.sites.filter(s=>s.role==='planetary_target').flatMap(t=>
  raw.analog_matching.selection.screening.filter((s:any)=>s.planetary_id===t.id&&s.earth_id.startsWith('scan-')&&typeof s.central_upper_bound_percent==='number')
    .sort((a:any,b:any)=>b.central_upper_bound_percent-a.central_upper_bound_percent||a.earth_id.localeCompare(b.earth_id)).slice(0,1));
const selected = [...catalog.pairings, ...raw.analog_matching.comparisons, ...bestScans];
const pairs = [...new Map(selected.map(p => [`${p.planetary_id}/${p.earth_id}`, p])).values()]
  .sort((a,b) => `${a.planetary_id}/${a.earth_id}`.localeCompare(`${b.planetary_id}/${b.earth_id}`));
const rows = pairs.map((p,i) => {
  const planetary = loadCatalogSite(catalog,p.planetary_id), earth = loadCatalogSite(catalog,p.earth_id);
  planetary.wind = earth.wind = {x:0,y:0};
  const stress = stressFidelity(planetary,earth,{base:{
    lander:{name:'Configured experimental lander',dryMassKg:800,fuelKg:350,maxThrustN:12000,limits:{maxSlopeDeg:12}},
    sensors:{hazard:'none',velocimeter:true},maxTimeS:300,
    gravity:planetary.body==='moon'?1.62:3.72,atmosphere:planetary.body==='moon'?0:0.02,
  },catalogTerrainScore:catalog.pairings.find(q=>q.earth_id===p.earth_id&&q.planetary_id===p.planetary_id)?.terrain_score??null});
  console.log(`${i+1}/${pairs.length} ${p.planetary_id}/${p.earth_id}: ${stress.score}`);
  return {earth_id:p.earth_id,planetary_id:p.planetary_id,stress};
});
const out = process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'data/staged/landing-similarity.json';
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify({schema_version:'1.0.0',method_version:'stress-baseline-1.0.0',
  catalog_sha256:createHash('sha256').update(readFileSync(new URL('../../../web/public/sites.json',import.meta.url))).digest('hex'),
  seeds:Array.from({length:25},(_,i)=>i+1),
  assumptions:'800 kg dry mass; 350 kg fuel; 12 kN thrust; 12 degree slope limit; default engine leg geometry; zero wind; no added rocks; site-derived interference; target gravity and air density. No scientific validation.',
  limitation:'25 sampled blind landings per patch; success share is not an area survey. Planetary grids are 150–500 m versus 30 m Earth grids. Coarse operational comparison, not landing safety.',
  source:'sites.json terrain manifests, source citations and checksums; app/sim/src/fidelity.ts',rows},null,2)+'\n');
