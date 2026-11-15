import { useEffect, useState } from 'react';
import type { Catalog } from '../lib/catalog';
import { currentStereoPilot, requestStereoPreview, stereoSelection, STEREO_CHANGE, type StereoPilot, type StereoSelection } from '../lib/stereoPilot';

export default function MeasuredTerrainPilot({catalog,targetId,earthId}:{catalog:Catalog;targetId:string;earthId:string}) {
  const [report,setReport]=useState<{pilots:Record<string,StereoPilot>}|null>(null);
  const [error,setError]=useState(false);
  const [selected,setSelected]=useState<string|null>(()=>stereoSelection()?.targetId??null);
  useEffect(()=>{
    const abort=new AbortController();
    void fetch(`${import.meta.env.BASE_URL}terrain-pilot-comparison.json`,{signal:abort.signal})
      .then(async r=>{if(!r.ok)throw new Error();return r.json();})
      .then(r=>{if(!abort.signal.aborted)setReport(r);})
      .catch(()=>{if(!abort.signal.aborted)setError(true);});
    const sync=(e:Event)=>setSelected((e as CustomEvent<StereoSelection|null>).detail?.targetId??null);
    window.addEventListener(STEREO_CHANGE,sync);
    return()=>{abort.abort();window.removeEventListener(STEREO_CHANGE,sync);};
  },[]);
  const pilot=report?.pilots[targetId];
  if(error)return <p role="status">The measured terrain pilot report is unavailable.</p>;
  if(!report)return <p role="status">Loading measured terrain pilots…</p>;
  if(!pilot)return <p>No verified full-coverage stereo pilot is staged for this target. The comparison uses its catalog DEM.</p>;
  if(!currentStereoPilot(catalog,targetId,pilot))return <p>Pilot inputs differ from the current catalog. Rebuild the pilot before interpreting it.</p>;
  const row=pilot.candidates[earthId], on=selected===targetId;
  return <section className="measured-terrain-pilot">
    <h3>Measured stereo terrain pilot</h3>
    <p>{pilot.product_id}. A {pilot.window_m.toLocaleString()} m square at the selected coordinates, area-averaged to {pilot.output_spacing_m} m cells. Full finite-pixel coverage verified; source posting approximately {pilot.source_metadata.native_spacing_m_approx.toFixed(1)} m.</p>
    {row&&<p>With the same {pilot.analysis_spacing_m} m analysis, frozen method and Earth candidates, this site's score rank changes from {row.baseline_score_rank} to {row.pilot_score_rank}. {pilot.top_ten_overlap}/10 top candidates are shared. This measures sensitivity to the source DEM; a changed rank does not establish better accuracy.</p>}
    <p>Fine-grid mean slope: {pilot.fine_descriptors.slope_mean?.toFixed(2)}°. These {pilot.output_spacing_m} m measurements are separate from the coarser ranking calculation.</p>
    <p>{pilot.relative_vertical_error_m===null?'Product-specific vertical-error estimate unavailable.':`Published relative vertical precision: ${pilot.relative_vertical_error_m} m. ${pilot.error_definition??''}`} {pilot.quality&&`Successful-correlation/manually-edited support: ${(100*pilot.quality.mean_accepted_fraction).toFixed(1)}% on average; lowest cell ${(100*pilot.quality.minimum_cell_accepted_fraction).toFixed(1)}%.`}</p>
    <ul>{pilot.warnings.map(w=><li key={w}>{w}</li>)}</ul>
    <button className="game-text" aria-pressed={on} onClick={()=>requestStereoPreview(on?null:{targetId,manifestUrl:pilot.manifest_url,baselineHash:pilot.catalog_elevation_sha256,elevationHash:pilot.pilot_elevation_sha256})}>{on?'Use catalog comparison terrain':'Preview measured stereo terrain'}</button>
    <p>The preview changes the cyan comparison surface within its measured footprint. Earth terrain, published recommendations and landing physics keep their catalog inputs.</p>
    <a href={pilot.source_metadata.url} target="_blank" rel="noreferrer">Stereo elevation source</a>
  </section>;
}
