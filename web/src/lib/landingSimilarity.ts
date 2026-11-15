import { useEffect, useState } from 'react';
import type { StressFidelityResult } from '../../../app/sim/src/fidelity';
import type { MissionConfig } from './types';
declare const __LANDING_ENGINE_SHA__:string;
export interface LandingRow {earth_id:string;planetary_id:string;stress:StressFidelityResult}
export interface LandingCatalog {schema_version:string;method_version:string;catalog_sha256:string;engine_sha256:string;seeds:number[];assumptions:string;limitation:string;rows:LandingRow[]}
let pending:Promise<LandingCatalog>|undefined;
/** The baseline has no equipment override. Custom gear, weather, or interference always runs live. */
export function isBaselineMission(mission:MissionConfig):boolean {
  const s=mission.strategy,e=mission.environment;
  return !mission.equipment && s.dryMassKg===800 && s.fuelMassKg===350 && s.thrusterForceN===12000
    && s.maxSlopeToleranceDeg===12 && e.windSpeedMs===0 && e.interferenceSource==='site' && !e.realWeather;
}
export function loadLandingSimilarity():Promise<LandingCatalog> {
  return pending ??= fetch('/landing-similarity.json').then(r=>{if(!r.ok)throw new Error('Landing baseline unavailable');return r.json();}).then(async data=>{
    if(data.schema_version!=='1.0.0'||!Array.isArray(data.rows))throw new Error('Unsupported landing baseline');
    if(typeof __LANDING_ENGINE_SHA__==='undefined'||data.engine_sha256!==__LANDING_ENGINE_SHA__)throw new Error('Landing baseline belongs to a different physics build');
    const response=await fetch('/sites.json');
    if(!response.ok)throw new Error('Cannot verify baseline catalog');
    const digest=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
    const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash!==data.catalog_sha256)throw new Error('Landing baseline belongs to a different catalog');
    return data;
  }).catch(error=>{pending=undefined;throw error;});
}
export function useLandingSimilarity(targetId:string,earthId:string) {
  const [data,setData]=useState<LandingCatalog|null>(null);
  useEffect(()=>{let active=true;loadLandingSimilarity().then(d=>{if(active)setData(d);}).catch(()=>{});return()=>{active=false;};},[]);
  return data?.rows.find(r=>r.planetary_id===targetId&&r.earth_id===earthId);
}
