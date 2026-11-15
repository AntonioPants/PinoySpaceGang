import { analogScoreFor, type Catalog } from './catalog';

export const STEREO_CHANGE = 'analog-atlas-stereo-preview-change';
export type StereoSelection = { targetId:string; manifestUrl:string; baselineHash:string; elevationHash:string };
let activeSelection:StereoSelection|null=null;
export const stereoSelection=()=>activeSelection;
export type StereoCandidate = { baseline_score_rank:number; pilot_score_rank:number; pilot_terrain_percent:number; pilot_similarity_percent:number; earth_elevation_sha256:string; baseline_similarity_percent:number };
export type StereoPilot = {
  catalog_elevation_sha256:string; pilot_elevation_sha256:string; manifest_url:string;
  product_id:string; output_spacing_m:number; window_m:number; minimum_cell_valid_fraction:number;
  analysis_spacing_m:number; analysis_window_m:number; top_ten_overlap:number;
  relative_vertical_error_m:number|null; error_definition:string|null; warnings:string[];
  quality:{mean_accepted_fraction:number; minimum_cell_accepted_fraction:number}|null;
  source_metadata:{url:string; native_spacing_m_approx:number; vertical_datum:string};
  fine_descriptors:Record<string,number|null>; candidates:Record<string,StereoCandidate>;
};

export function currentStereoPilot(catalog:Catalog,targetId:string,pilot?:StereoPilot):pilot is StereoPilot {
  return !!pilot && pilot.catalog_elevation_sha256===catalog.entries.get(targetId)?.terrain?.elevation_sha256
    && pilot.minimum_cell_valid_fraction>=1-1e-6
    && pilot.manifest_url===`/terrain-pilots/${targetId}/manifest.json`
    && /^[a-f0-9]{64}$/.test(pilot.pilot_elevation_sha256)
    && Object.keys(pilot.candidates).length===catalog.analogs.filter(s=>s.available).length
    && Object.entries(pilot.candidates).every(([id,row])=>{
      const value=analogScoreFor(catalog,targetId,id);
      return row.earth_elevation_sha256===catalog.entries.get(id)?.terrain?.elevation_sha256
        && value!==null&&Math.abs(value-row.baseline_similarity_percent)<.001;
    });
}
export function requestStereoPreview(selection:StereoSelection|null) {
  activeSelection=selection;
  window.dispatchEvent(new CustomEvent(STEREO_CHANGE,{detail:selection}));
}
