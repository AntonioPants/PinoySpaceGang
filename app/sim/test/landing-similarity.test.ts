import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {stressFidelity} from '../src/fidelity';
import {loadCatalogSite,readCatalog} from '../scripts/catalog-node';
import {engineFingerprint} from '../scripts/engine-fingerprint';
it('published landing baseline has finite bounded results and explicit sampling assumptions',()=>{
  const data=JSON.parse(readFileSync(new URL('../../../web/public/landing-similarity.json',import.meta.url),'utf8'));
  expect(data.schema_version).toBe('1.0.0');expect(data.seeds).toEqual(Array.from({length:25},(_,i)=>i+1));
  expect(data.engine_sha256).toBe(engineFingerprint());
  expect(data.assumptions).toContain('zero wind');expect(data.limitation).toContain('not landing safety');
  for(const row of data.rows){
    expect(row.stress.score).toBeGreaterThanOrEqual(0);expect(row.stress.score).toBeLessThanOrEqual(100);
    expect(row.stress.method).toContain('25 blind landings');
    for(const s of [row.stress.planetary,row.stress.analog]){
      expect(s.flights).toBe(25);expect(s.successRate).toBeGreaterThanOrEqual(0);expect(s.successRate).toBeLessThanOrEqual(1);
      expect(Number.isFinite(s.meanSlopeDeg)).toBe(true);
    }
  }
});
it('blind landing comparison repeats deterministically for real catalog terrain',()=>{
  const c=readCatalog(),p=loadCatalogSite(c,'marius-hills'),a=loadCatalogSite(c,'craters-moon');
  expect(stressFidelity(p,a,{gridSize:2})).toEqual(stressFidelity(p,a,{gridSize:2}));
});
