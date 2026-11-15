import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { buildLander, type Lander } from '../../components/cutscene/lander';
import { antennaPackages, defaultAppearance, liveries, solarArrays } from '../../lib/landerAppearance';
import { landingGear, sensors, vehicles, type EquipmentSelection } from './equipmentCatalog';

export interface EquipmentBayProps { selection: EquipmentSelection; onChange: (selection: EquipmentSelection) => void; launching?: boolean }
function disposeModel(root: T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(), materials=new Set<T.Material>();
  root.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
export default function EquipmentBay({selection,onChange,launching=false}:EquipmentBayProps) {
  const host=useRef<HTMLDivElement>(null), [error,setError]=useState(false), launchedAt=useRef(0);
  const [section,setSection]=useState<'hardware'|'appearance'>('hardware');
  const sceneRef=useRef<T.Scene|null>(null), shipRef=useRef<Lander|null>(null), resetView=useRef(()=>{});
  useEffect(()=>{launchedAt.current=launching?performance.now():0;},[launching]);
  useEffect(()=>{
    const mount=host.current!;let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{setError(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    mount.append(renderer.domElement);renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Interactive lander equipment preview. Drag to rotate; scroll to zoom.');
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,100);sceneRef.current=scene;
    const controls=new OrbitControls(camera,renderer.domElement);
    const reset=()=>{camera.position.set(10,7,12);controls.target.set(0,2.1,0);controls.update();};resetView.current=reset;reset();
    controls.enableDamping=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;controls.enablePan=false;controls.minDistance=8;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.49;
    scene.add(new T.HemisphereLight(0xe8edf5,0x343442,2.2));
    const key=new T.DirectionalLight(0xffe4ba,4);key.position.set(-5,7,5);scene.add(key);
    const rim=new T.DirectionalLight(0xb3cfff,3);rim.position.set(4,5,-6);scene.add(rim);
    const platform=new T.Mesh(new T.CylinderGeometry(5.1,5.3,.18,80),new T.MeshStandardMaterial({color:0x1b1c1e,metalness:.6,roughness:.6}));platform.position.y=-.2;scene.add(platform);
    const ring=new T.Mesh(new T.TorusGeometry(4.8,.018,8,100),new T.MeshBasicMaterial({color:0xd6b77c}));ring.rotation.x=-Math.PI/2;ring.position.y=-.09;scene.add(ring);const ringColour=(ring.material as T.MeshBasicMaterial).color;
    const resize=new ResizeObserver(()=>{const w=mount.clientWidth,h=mount.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}});resize.observe(mount);
    let frame=0;const draw=()=>{
      const ship=shipRef.current;
      if(launchedAt.current&&ship){
        const t=(performance.now()-launchedAt.current)/1000,rise=Math.max(0,t-.35);
        controls.enabled=false;ship.group.position.y=(t<.3?-Math.sin(t/.3*Math.PI)*.14:0)+8*rise*rise+40*rise*rise*rise;
        ship.flame.visible=t>.3;ship.flame.scale.y=Math.max(0,Math.min(1.7,(t-.3)*5))*(.9+Math.random()*.2);
        ringColour.setHex(t<.3?0xfff3d0:0xd6b77c);controls.target.y=2.1+Math.min(rise*2.2,3.5);
      }
      controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
    return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();if(shipRef.current)scene.remove(shipRef.current.group);disposeModel(scene);renderer.dispose();renderer.domElement.remove();sceneRef.current=null;shipRef.current=null;resetView.current=()=>{};};
  },[]);
  useEffect(()=>{
    const scene=sceneRef.current;if(!scene)return;
    const ship=buildLander(selection);shipRef.current=ship;scene.add(ship.group);
    return()=>{scene.remove(ship.group);disposeModel(ship.group);if(shipRef.current===ship)shipRef.current=null;};
  },[selection.vehicleId,selection.landingGearId,selection.hazardSensor,selection.liveryId,selection.solarArrayId,selection.antennaId]);
  const hardware=[{label:'Spacecraft',key:'vehicleId' as const,items:vehicles},{label:'Landing gear',key:'landingGearId' as const,items:landingGear},{label:'Hazard sensor',key:'hazardSensor' as const,items:sensors}];
  const appearance=[{label:'Solar arrays',key:'solarArrayId' as const,items:solarArrays},{label:'Communications',key:'antennaId' as const,items:antennaPackages}];
  const groups=section==='hardware'?hardware:appearance;
  const activeLivery=liveries.find(livery=>livery.id===selection.liveryId)??liveries[0];
  return <>
    <div className="equipment-scene" ref={host}>{error&&<p role="status">3D preview unavailable. Equipment controls remain available.</p>}</div>
    <div className="equipment-view-tools"><span>Drag to orbit · Scroll to zoom</span><button onClick={()=>resetView.current()} disabled={launching||error} aria-label="Reset preview camera"><RotateCcw size={14}/> Reset view</button></div>
    <div className="equipment-rails">
      <div className="equipment-tabs" role="group" aria-label="Customization category">
        <button aria-pressed={section==='hardware'} onClick={()=>setSection('hardware')} disabled={launching}>Hardware</button>
        <button aria-pressed={section==='appearance'} onClick={()=>setSection('appearance')} disabled={launching}>Appearance</button>
      </div>
      {section==='appearance'&&<section className="equipment-rail"><div className="rail-heading"><span>Hull livery</span><span>5 finishes</span></div><strong className="livery-name" aria-live="polite">{activeLivery.name}</strong><div className="livery-swatches" role="group" aria-label="Hull livery">{liveries.map(livery=><button key={livery.id} aria-label={livery.name} title={livery.name} aria-pressed={activeLivery.id===livery.id} disabled={launching} onClick={()=>onChange({...selection,liveryId:livery.id})}><span style={{background:livery.swatch}}/>{activeLivery.id===livery.id&&<span className="swatch-check">✓</span>}</button>)}</div><p>Coordinated hull, cabin and accent finishes.</p></section>}
      {groups.map(group=>{
        const selected=selection[group.key]??defaultAppearance[group.key as keyof typeof defaultAppearance];
        const index=Math.max(0,group.items.findIndex(item=>item.id===selected)),item=group.items[index];
        const cycle=(n:number)=>onChange({...selection,[group.key]:group.items[(index+n+group.items.length)%group.items.length].id});
        return <section className="equipment-rail" key={group.key}><div className="rail-heading"><span>{group.label}</span><span>{index+1} / {group.items.length}</span></div><div className="rail-choice"><button aria-label={`Previous ${group.label.toLowerCase()}`} disabled={launching} onClick={()=>cycle(-1)}><ChevronLeft/></button><strong aria-live="polite">{item.name}</strong><button aria-label={`Next ${group.label.toLowerCase()}`} disabled={launching} onClick={()=>cycle(1)}><ChevronRight/></button></div><p>{'role' in item&&<>{item.role}<br/></>}{item.detail}</p></section>;
      })}
      <p className="gear-note">{section==='hardware'?'Prototype loadouts. The gear is simulated: stroke and damping set the sink rate it absorbs, stance and leg count set when it tips, and its mass rides along. Trim it on the bridge.':'45 appearance combinations. Finishes, solar arrays and antennas are visual choices; mass, thrust and sensor performance stay with your hardware.'}</p>
      {section==='appearance'&&<button className="equipment-reset" disabled={launching} onClick={()=>onChange({...selection,...defaultAppearance})}>Reset appearance</button>}
    </div>
  </>;
}
