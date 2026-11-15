import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseCatalog, matchOf } from './catalog';
import { currentAudit, currentAuditDataset, type ValidityRow } from '../components/ComparisonValidity';

const file = (path:string) => readFileSync(new URL(`../../public/${path}`,import.meta.url),'utf8');
const catalog=parseCatalog(JSON.parse(file('sites.json')));
describe('published validity audit',()=>{
  it('is bound to the exact catalog and covers every comparison without changing its score or rank',()=>{
    const index=JSON.parse(file('comparison-validity.json'));
    expect(index.catalog_sha256).toBe(createHash('sha256').update(file('sites.json')).digest('hex'));
    expect(index.independent_validation.validated_accuracy_percent).toBeNull();
    for(const target of catalog.targets){
      const audit=JSON.parse(file(`comparison-validity/${target.id}.json`));
      expect(currentAuditDataset(catalog,target.id,audit)).toBe(true);
      for(const earth of catalog.analogs.filter(e=>e.available)){
        const row=audit.candidates[earth.id] as ValidityRow;
        expect(currentAudit(catalog,target.id,earth.id,row)).toBe(true);
        const match=matchOf(catalog,target.id,earth.id);
        if(match) expect(row.baseline_rank).toBe(match.candidate_rank);
        for(const rank of Object.values(row.sensitivity)){
          expect(rank.valid_runs).toBeLessThanOrEqual(rank.requested_runs);
          expect(rank.top_ten_runs).toBeLessThanOrEqual(rank.valid_runs);
        }
      }
    }
  });
  it('rejects changed terrain or scores instead of showing stale evidence',()=>{
    const audit=JSON.parse(file('comparison-validity/jezero.json'));
    const row=audit.candidates.badwater as ValidityRow;
    expect(currentAudit(catalog,'jezero','badwater',{...row,earth_elevation_sha256:'changed'})).toBe(false);
    expect(currentAudit(catalog,'jezero','badwater',{...row,similarity_percent:0})).toBe(false);
    const altered={...catalog,entries:new Map(catalog.entries)};
    const other=altered.entries.get('amboy')!;
    altered.entries.set('amboy',{...other,terrain:{...other.terrain!,elevation_sha256:'changed'}});
    expect(currentAuditDataset(altered,'jezero',audit)).toBe(false);
  });
});
