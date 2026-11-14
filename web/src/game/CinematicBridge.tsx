import { useEffect, useState } from 'react';
import Cutscene from '../components/cutscene/Cutscene';
import { loadTerrainPack, type TerrainPack } from '../components/cutscene/terrainPack';
import type { OutcomeSceneProps, SceneProps } from './contracts';

/** Adapt Furgan's shipped Earth scenes; never substitute a demo flight or a procedural site. */
function EarthScene(props: SceneProps & { flight?: OutcomeSceneProps['flight'] }) {
  const {mission,reducedMotion,onComplete,flight}=props;
  const [pack,setPack]=useState<TerrainPack|null>(null),[error,setError]=useState('');
  useEffect(()=>{const abort=new AbortController();setPack(null);setError('');
    if(!reducedMotion)loadTerrainPack(mission.earthAnalog.terrainBaseUrl,abort.signal).then(p=>{if(p.manifest.id!==mission.earthAnalog.id)throw new Error('Cinematic terrain does not match the mission.');if(!abort.signal.aborted)setPack({...p,manifest:{...p.manifest,source:{...p.manifest.source,dataset:p.manifest.source.dataset??'Copernicus DEM GLO-30'}}});}).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Cinematic terrain unavailable.');});
    return()=>abort.abort();
  },[mission.earthAnalog.id,mission.earthAnalog.terrainBaseUrl,reducedMotion]);
  if(reducedMotion||error)return <section className="systems-console"><h2>{flight?'Landing recorded':'Earth approach'}</h2><p>{error||'Reduced motion is enabled. Continue without the cinematic.'}</p><button className="primary-button" onClick={onComplete}>Continue journey</button></section>;
  if(!pack)return <p role="status">Loading the selected terrain for the cinematic…</p>;
  return <Cutscene kind={flight?'ending':'opening'} env={{name:mission.earthAnalog.name,subtitle:flight?'Recorded flight outcome':'Approaching your Earth test ground',preset:/haughton|barrow/.test(mission.earthAnalog.id)?'ice':'crater'}} terrain={pack} flight={flight} start={{position:{x:-400,y:0,z:1000},velocity:{x:25,y:0,z:-20}}} target={{x:0,y:0}} muted onDone={onComplete}/>;
}
export function EarthApproach(props:SceneProps){return <EarthScene {...props}/>;}
export function LandingOutcome(props:OutcomeSceneProps){return <EarthScene {...props}/>;}
