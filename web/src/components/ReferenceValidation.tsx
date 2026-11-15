import { useEffect, useState } from 'react';

type Reference = {id:string;planetary_id:string;scope:string;source_url:string;eligible:boolean;exclusions:string[]};
type Result = {reference_id:string;planetary_name:string;earth_name:string;score_only_rank:number|null;candidate_count:number;source_url:string;scope:string;counterevidence_url?:string;exclusions:string[]};
type Report = {independent_metrics:{eligible_references:number;independent_regions:number};exploratory_retrieval:Result[];reference_audit:{references:Reference[]}};
const exclusionName=(s:string)=>({independent_review_pending:'Independent project review pending',
  development_exposure_not_verified:'Held-out exposure has not been independently verified',
  reference_not_terrain_shape_ground_truth:'Published analogy does not supply regional terrain-shape ground truth',
  reference_features_unresolved_at_analysis_scale:'Reference features are unresolved at the tested analysis spacing'} as Record<string,string>)[s]??s.replace(/_/g,' ');

export default function ReferenceValidation({targetId}:{targetId:string}) {
  const [report,setReport]=useState<Report|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{const abort=new AbortController();
    void fetch(`${import.meta.env.BASE_URL}external-validation.json`,{signal:abort.signal})
      .then(async r=>{if(!r.ok)throw new Error();return r.json() as Promise<Report>;})
      .then(r=>{if(!abort.signal.aborted)setReport(r);})
      .catch(()=>{if(!abort.signal.aborted)setFailed(true);});
    return()=>abort.abort();
  },[]);
  if(failed)return <p role="status">Published reference results could not be loaded.</p>;
  if(!report)return <p role="status">Loading published reference checks…</p>;
  return <section className="reference-validation">
    <h3>Checks against published analogs</h3>
    <p>{report.independent_metrics.eligible_references} references currently qualify for independent terrain validation. The method, candidate pool and development regions were frozen before the reserved reference terrain was evaluated. Project review is pending.</p>
    {report.reference_audit.references.filter(r=>r.planetary_id===targetId).map(r=><div key={r.id}>
      <p><a href={r.source_url} target="_blank" rel="noreferrer">Published evidence for this target</a>: {r.scope}</p>
      <p>This source does not validate every suggested Earth site.</p>
    </div>)}
    {report.exploratory_retrieval.map(r=><div key={r.reference_id}>
      <p>Reserved pilot: {r.planetary_name} / {r.earth_name}. Rank {r.score_only_rank??'unavailable'} among {r.candidate_count} Earth candidates, without literature priority.</p>
      <p>{r.scope}</p>
      <ul>{r.exclusions.map(s=><li key={s}>{exclusionName(s)}.</li>)}</ul>
      <p><a href={r.source_url} target="_blank" rel="noreferrer">Analog study</a>{r.counterevidence_url&&<> · <a href={r.counterevidence_url} target="_blank" rel="noreferrer">Alternative formation mechanisms</a></>}</p>
    </div>)}
    <small>A top-ten result alone is insufficient. These checks retain misses and exclusions; unlabelled candidates are not verified negatives. No accuracy percentage is established.</small>
  </section>;
}
