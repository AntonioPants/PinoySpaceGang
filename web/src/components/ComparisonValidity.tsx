import { useEffect, useState } from 'react';
import { analogScoreFor, matchOf, pairingOf, type Catalog } from '../lib/catalog';
import { percent } from '../lib/matching';
import MeasuredTerrainPilot from './MeasuredTerrainPilot';
import ReferenceValidation from './ReferenceValidation';

type Feature = { feature: string; unit: string; earth: number; planetary: number; scaled_difference: number };
type Rank = { rank_range: [number, number] | null; top_ten_runs: number; valid_runs: number; requested_runs: number };
export type ValidityRow = {
  earth_elevation_sha256: string; planetary_elevation_sha256: string;
  baseline_rank: number | null; score_only_rank: number | null; similarity_percent: number | null;
  terrain_percent: number | null; evidence_priority: boolean; substrates: string[];
  sensitivity: Record<'window' | 'weight' | 'scale', Rank>;
  closest_features: Feature[]; largest_differences: Feature[]; source_urls: string[];
};
export type Audit = { analysis_spacing_m: number; analysis_window_m: number; scale_test_spacing_m: number[]; candidates: Record<string, ValidityRow> };

export function currentAudit(catalog: Catalog, targetId: string, earthId: string, row?: ValidityRow) {
  const earth = catalog.entries.get(earthId)?.terrain, planet = catalog.entries.get(targetId)?.terrain;
  const value = analogScoreFor(catalog, targetId, earthId);
  const published = matchOf(catalog,targetId,earthId);
  return !!row && row.earth_elevation_sha256 === earth?.elevation_sha256
    && row.planetary_elevation_sha256 === planet?.elevation_sha256
    && row.evidence_priority === !!pairingOf(catalog,targetId,earthId)
    && (!published || published.candidate_rank === row.baseline_rank)
    && typeof value === 'number' && row.similarity_percent !== null && Math.abs(value-row.similarity_percent) < .001;
}
export function currentAuditDataset(catalog:Catalog,targetId:string,audit:Audit) {
  return Object.keys(audit.candidates).length===catalog.analogs.filter(s=>s.available).length
    && Object.entries(audit.candidates).every(([id,row])=>currentAudit(catalog,targetId,id,row));
}
const featureName = (s: string) => /^slope_gt_\d+$/.test(s) ? `Area steeper than ${s.split('_')[2]}°`
  : ({slope_mean:'Mean slope',slope_p90:'90th percentile slope',bowl_share:'Bowl-shaped area',ridge_share:'Ridge-shaped area',
      relief:'Elevation range',hypsometric_integral:'Relative mean elevation'} as Record<string,string>)[s] ?? s.replace(/_/g,' ');
const range = (r: Rank) => r.rank_range ? `${r.rank_range[0]}–${r.rank_range[1]}` : 'unavailable';

export default function ComparisonValidity({catalog,targetId,earthId}: {catalog:Catalog;targetId:string;earthId:string}) {
  const [open,setOpen] = useState(false);
  const [loaded,setLoaded] = useState<{id:string; audit:Audit} | null>(null);
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const abort=new AbortController(); setError('');
    void fetch(`${import.meta.env.BASE_URL}comparison-validity/${encodeURIComponent(targetId)}.json`,{signal:abort.signal})
      .then(async response => { if(!response.ok) throw new Error('Audit unavailable'); return response.json() as Promise<Audit>; })
      .then(audit => { if(!abort.signal.aborted) setLoaded({id:targetId,audit}); })
      .catch(() => { if(!abort.signal.aborted) setError('The validity audit could not be loaded.'); });
    return () => abort.abort();
  },[open,targetId,attempt]);
  const audit=loaded?.id===targetId ? loaded.audit : null;
  const row=audit?.candidates[earthId];
  const match=matchOf(catalog,targetId,earthId);
  const hasProposals=catalog.pairings.some(p=>p.planetary_id===targetId);
  return <details className="comparison-validity" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary>Comparison validity &amp; ranking stability</summary>
    <p>Terrain shape: {percent(match?.terrain_similarity_percent)}. Geology and materials: catalog interpretations; material equivalence unverified. Landing behaviour: assessed separately by the flight model with prototype equipment; field validation pending.</p>
    {error ? <p role="status">{error} <button className="game-text" onClick={()=>setAttempt(a=>a+1)}>Retry audit</button></p> : !audit ? <p role="status">Loading comparison audit…</p> : !currentAuditDataset(catalog,targetId,audit) ? <p>Audit inputs differ from the current catalog. Regenerate the audit before interpreting these results.</p> : row && <>
      <p>Published rank {row.baseline_rank}; rank by similarity alone {row.score_only_rank}. {row.evidence_priority ? 'This pair receives literature-proposal priority.' : hasProposals ? 'Literature proposals take priority over this exploratory candidate.' : 'All candidates for this target are ranked by similarity.'} Both use the available Earth catalog.</p>
      <p>Analysis: {audit.analysis_window_m.toLocaleString()} m window, {audit.analysis_spacing_m} m cells. Earth material: {row.substrates[0].replace(/_/g,' ')}; target: {row.substrates[1].replace(/_/g,' ')}. Matching labels do not measure soil strength.</p>
      <h3>How the rank changes</h3>
      {Object.values(row.sensitivity).some(r=>r.rank_range && r.rank_range[0]<=10 && r.rank_range[1]>10) && <p>This candidate moves into and out of the top ten under the tested choices. Its recommendation is sensitive.</p>}
      <ul>{([['window','Window shifts'],['weight','Landform weights'],['scale','Sampling scale']] as const).map(([key,label])=><li key={key}>{label}: rank {range(row.sensitivity[key])}; top ten in {row.sensitivity[key].top_ten_runs}/{row.sensitivity[key].requested_runs} scenarios. {row.sensitivity[key].valid_runs < row.sensitivity[key].requested_runs && 'Some scenarios lack sufficient data.'}</li>)}</ul>
      <small>25 window combinations (centre and ±250 m east/north); landform weights 25%, 50%, 75%; sampling at {audit.scale_test_spacing_m.join(' and ')} m using shared resolved features. Each test varies one choice. These ranges are sensitivity checks, not confidence intervals or probabilities.</small>
      <h3>Closest measured descriptors</h3>
      <ul>{row.closest_features.map(f=><li key={f.feature}>{featureName(f.feature)}: Earth {f.earth} / target {f.planetary} {f.unit==='1'?'(fraction)':f.unit}</li>)}</ul>
      <h3>Largest measured differences</h3>
      <ul>{row.largest_differences.map(f=><li key={f.feature}>{featureName(f.feature)}: Earth {f.earth} / target {f.planetary} {f.unit==='1'?'(fraction)':f.unit}</li>)}</ul>
      <small>Descriptors are ordered by difference relative to the frozen Earth reference spread. A small difference alone does not establish an analog. Zero steep-area fractions apply only to this coarse analysis; smaller hazards may be unresolved.</small>
      <p>{row.source_urls.map((url,i)=><a key={`${i}-${url}`} href={url} target="_blank" rel="noreferrer">{i===0?'Earth elevation source':'Planetary elevation source'}{i===0?' · ':''}</a>)}</p>
    </>}
    <p>Independent scientific validation is pending. The external reference register checks reused pairings, regions used to fit scales, development exposure and missing terrain before admitting a reference.</p>
    <a href={`${import.meta.env.BASE_URL}comparison-validity.json`} target="_blank" rel="noreferrer">Validation status and reference exclusions (JSON)</a>
    {open&&<MeasuredTerrainPilot catalog={catalog} targetId={targetId} earthId={earthId}/>}
    {open&&<ReferenceValidation targetId={targetId}/>}
    <p><a href={`${import.meta.env.BASE_URL}external-validation.json`} target="_blank" rel="noreferrer">Published-reference pilot results and unresolved evidence (JSON)</a></p>
  </details>;
}
