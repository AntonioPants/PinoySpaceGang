import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {CatalogSite} from '../../../../app/sim/src/catalog';
import type {TerrainProfile} from '../../lib/types';
import {prepareTerrain,type TerrainData,type TerrainSiteMetadata} from './terrain3d/data';
import {makeTerrainScene,type TerrainMarker} from './terrain3d/scene';
import './terrain3d/comparison.css';
export type {TerrainSiteMetadata,TerrainMarker};
export interface TerrainComparison3DProps {
  earthProfile?:TerrainProfile|null;
  targetProfile?:TerrainProfile|null;
  /** Earth catalog entry; alias retained for a drop-in single-entry consumer. */
  catalogEntry?:CatalogSite;
  earthEntry?:CatalogSite;targetEntry?:CatalogSite;
  earthMetadata?:TerrainSiteMetadata;targetMetadata?:TerrainSiteMetadata;
  /** Target-local touchdown. Never pass an Earth flight point as a measured planetary landing. */
  touchdown?:TerrainMarker|null;
  /** Earth-local telemetry samples. No markers are invented when absent. */
  rehearsalPoints?:ReadonlyArray<TerrainMarker>;
  className?:string;
}
const EMPTY_POINTS:ReadonlyArray<TerrainMarker>=[];
type Prepared={data:TerrainData;error?:never}|{data?:never;error:string};
function prepare(profile:TerrainProfile|null|undefined,entry:CatalogSite|undefined,meta:TerrainSiteMetadata|undefined,body:string):Prepared{
  try{return {data:prepareTerrain(profile,entry,meta,body)};}catch(error){return {error:error instanceof Error?error.message:'Terrain could not be read.'};}
}
function Metadata({prepared}:{prepared:Prepared}){
  if(!prepared.data)return <div className="tc3d-metadata" role="status">{prepared.error}</div>;
  const d=prepared.data,f=(n:number|null)=>n===null?'unknown':n.toFixed(2);
  return <div className="tc3d-metadata"><strong>{d.name}</strong>
    {d.synthetic&&<span className="tc3d-synthetic">Synthesized from catalog DEM stats</span>}
    <span>{d.width.toFixed(0)} × {d.depth.toFixed(0)} m · Mean / P95 slope {f(d.meanSlope)}° / {f(d.p95Slope)}°</span>
    <span>{d.synthetic?'Synthetic display grid':<>Elevation data: {d.sourcePage?<a href={d.sourcePage} target="_blank" rel="noreferrer">{d.source}</a>:d.source}</>} · {d.dx.toFixed(1)} × {d.dy.toFixed(1)} m grid{d.nativeResolution?` · source ≈ ${d.nativeResolution.toFixed(1)} m`:''}</span>
    <span>Illustrative sun {d.sunElevation.toFixed(1)}° elevation, {d.sunAzimuth.toFixed(0)}° azimuth; tint is not mineral mapping.</span>
    <details><summary>Data and resolution limits</summary><p>{d.note}</p><p>Relief {d.relief.toFixed(1)} m. Display-grid 3×3 RMS {d.roughness.toFixed(1)} m over {(d.dx*2).toFixed(0)} × {(d.dy*2).toFixed(0)} m sample-centre support. {d.missing} nodata samples; gaps are not filled. Slope statistics use valid grid derivatives at each site's own resolution; different resolutions are not directly comparable. Coarse DEMs do not resolve footpad hazards.</p>{d.sourceUrl&&/^https?:\/\//.test(d.sourceUrl)&&<p>Cut from the dataset's original elevation file, listed here for reproducibility: <code>{d.sourceUrl.split('/').pop()}</code>. The full file is also recorded in the downloadable report.</p>}</details>
  </div>;
}
/** One WebGL context, two scissored orthographic views, equal metres per pixel.
 * No fetches, physics changes, scene registration or catalog mutation.
 */
export default function TerrainComparison3D({earthProfile,targetProfile,catalogEntry,earthEntry,targetEntry,earthMetadata,targetMetadata,touchdown,rehearsalPoints=EMPTY_POINTS,className=''}:TerrainComparison3DProps){
  const earth=useMemo(()=>prepare(earthProfile,earthEntry??catalogEntry,earthMetadata,'earth'),[earthProfile,earthEntry,catalogEntry,earthMetadata]);
  const target=useMemo(()=>prepare(targetProfile,targetEntry,targetMetadata,'moon'),[targetProfile,targetEntry,targetMetadata]);
  // The pane is named for the world the player picked: "Moon Landing Zone" or "Mars Landing Zone".
  const world=String(target.data?.body??targetMetadata?.body??targetEntry?.body??targetProfile?.manifest.body??'').toLowerCase();
  const worldName=world==='mars'?'Mars':world==='moon'?'Moon':'Target';
  const host=useRef<HTMLDivElement>(null),left=useRef<HTMLDivElement>(null),right=useRef<HTMLDivElement>(null);
  const command=useRef<(action:string)=>void>(()=>{});
  const [heatmap,setHeatmap]=useState(false),[wire,setWire]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[scale,setScale]=useState(0),[omitted,setOmitted]=useState(0);
  const mode=useRef({heatmap,wire});mode.current={heatmap,wire};
  useEffect(()=>{command.current('mode');},[heatmap,wire]);
  useEffect(()=>{
    const mount=host.current;if(!mount||!left.current||!right.current)return;
    setError('');setOmitted(0);
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{setError('3D unavailable. Site statistics and source records remain below.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.setScissorTest(true);renderer.domElement.className='tc3d-canvas';renderer.domElement.setAttribute('aria-hidden','true');mount.prepend(renderer.domElement);
    const data=[earth.data,target.data];
    const scenes=data.map((d,i)=>d?makeTerrainScene(d,i===0?[...rehearsalPoints]:touchdown?[touchdown]:[]):null);
    setOmitted(scenes.reduce((n,s)=>n+(s?.omitted??0),0));
    const span=Math.max(100,...data.flatMap(d=>d?[d.width,d.depth,d.relief*2]:[]));
    const cameras=[0,1].map(()=>new THREE.OrthographicCamera(-span,span,span,-span,.1,span*20));
    const controls=[new OrbitControls(cameras[0],left.current),new OrbitControls(cameras[1],right.current)];
    controls.forEach(c=>{c.enableDamping=false;c.minZoom=.2;c.maxZoom=80;c.maxPolarAngle=Math.PI/2-.01;});
    let frame=0,disposed=false,syncing=false,width=0,height=0;
    const draw=()=>{
      frame=0;if(disposed||!width||!height||renderer.getContext().isContextLost())return;
      const half=Math.floor(width/2);
      for(let i=0;i<2;i++){
        renderer.setViewport(i?half:0,0,i?width-half:half,height);renderer.setScissor(i?half:0,0,i?width-half:half,height);
        if(scenes[i])renderer.render(scenes[i]!.scene,cameras[i]);else{renderer.setClearColor('#0a0c0f');renderer.clear();}
      }
      setScale(span/cameras[0].zoom/height*60);
    };
    const request=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(draw);};
    const synchronize=(from:number)=>{
      if(syncing)return;syncing=true;const to=1-from;
      cameras[to].position.copy(cameras[from].position);cameras[to].quaternion.copy(cameras[from].quaternion);cameras[to].zoom=cameras[from].zoom;
      controls[to].target.copy(controls[from].target);cameras[to].updateProjectionMatrix();controls[to].update();syncing=false;request();
    };
    const changed=[()=>synchronize(0),()=>synchronize(1)];controls.forEach((c,i)=>c.addEventListener('change',changed[i]));
    const reset=()=>{syncing=true;controls.forEach((c,i)=>{cameras[i].position.set(span*.8,span*.75,span*.9);cameras[i].zoom=1;c.target.set(0,0,0);cameras[i].updateProjectionMatrix();c.update();});syncing=false;request();};
    command.current=action=>{
      if(action==='reset')reset();
      if(action==='in'||action==='out'){cameras[0].zoom=THREE.MathUtils.clamp(cameras[0].zoom*(action==='in'?1.25:.8),.2,80);cameras[0].updateProjectionMatrix();synchronize(0);}
      if(action==='mode'){scenes.forEach(s=>s?.setMode(mode.current.heatmap,mode.current.wire));request();}
    };
    const resize=()=>{width=mount.clientWidth;height=mount.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);
      cameras.forEach((c,i)=>{const w=i?width-Math.floor(width/2):Math.floor(width/2);c.left=-span*w/height/2;c.right=-c.left;c.top=span/2;c.bottom=-span/2;c.updateProjectionMatrix();});request();};
    const observer=new ResizeObserver(resize);observer.observe(mount);
    const lost=(event:Event)=>{event.preventDefault();setError('WebGL context lost. Retry 3D to restore the views.');};
    renderer.domElement.addEventListener('webglcontextlost',lost);
    scenes.forEach(s=>s?.setMode(mode.current.heatmap,mode.current.wire));reset();resize();
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.forEach((c,i)=>{c.removeEventListener('change',changed[i]);c.dispose();});scenes.forEach(s=>s?.dispose());renderer.domElement.removeEventListener('webglcontextlost',lost);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();command.current=()=>{};};
  },[earth,target,touchdown,rehearsalPoints,retry]);
  return <section className={`tc3d ${className}`} aria-label="Side-by-side terrain comparison">
    <div className="tc3d-toolbar" role="group" aria-label="Terrain visualization"><button aria-pressed={!heatmap} onClick={()=>setHeatmap(false)}>Natural / solar elevation</button><button aria-pressed={heatmap} onClick={()=>setHeatmap(true)}>Slope &amp; hazard heatmap</button><button aria-pressed={wire} onClick={()=>setWire(!wire)}>Wireframe</button><button onClick={()=>command.current('reset')}>Reset View</button><button aria-label="Zoom in both terrains" onClick={()=>command.current('in')}>+</button><button aria-label="Zoom out both terrains" onClick={()=>command.current('out')}>−</button></div>
    <div className="tc3d-view" ref={host}>
      {[left,right].map((ref,i)=><div key={i} ref={ref} className={`tc3d-pane tc3d-pane-${i}`} tabIndex={0} role="group" aria-label={`${i?worldName:'Earth analog'} terrain controls: drag to orbit, right-drag to pan, wheel to zoom`} onKeyDown={e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();command.current(e.key==='0'?'reset':e.key==='-'?'out':'in');}}}>
        <strong className="tc3d-title">{i?`${worldName} Landing Zone`:'Earth Analog Landing Zone'}</strong>
        <span className="tc3d-scale"><i/>{scale>0?`${scale.toFixed(scale<10?1:0)} m`:''} · view-plane scale</span>
        {!(i?target.data:earth.data)&&<span className="tc3d-unavailable">Terrain unavailable — see metadata</span>}
      </div>)}
      {error&&<div className="tc3d-error" role="status">{error}<button onClick={()=>setRetry(n=>n+1)}>Retry 3D</button></div>}
    </div>
    <p className="tc3d-note">Synchronized orbit, pan and zoom · East right / north away at reset · 1 m horizontal = 1 m vertical; no exaggeration. {heatmap?'Screening bands: green <3°, amber 3–5°, red >5°. Not vehicle-specific safety or lander tolerance; grey = unknown slope.':'Lighting and surface tint are illustrative, not measured acquisition conditions.'} {wire?'Wireframe shows native mesh triangulation.':''}</p>
    {(touchdown||rehearsalPoints.length>0)&&<p className="tc3d-note">Green beacons mark supplied local coordinates. Footprint radius uses the supplied value, otherwise an assumed 2 m. Beacons are enlarged for visibility; rings remain metric. {omitted>0?`${omitted} markers omitted outside valid terrain.`:''} {earth.data?.synthetic||target.data?.synthetic?'Markers on synthetic terrain do not locate real landing features.':''}</p>}
    <div className="tc3d-footers"><Metadata prepared={earth}/><Metadata prepared={target}/></div>
  </section>;
}
