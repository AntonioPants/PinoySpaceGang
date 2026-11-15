import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildLander } from '../../components/cutscene/lander';
import { landingGear, sensors, vehicles, type EquipmentSelection } from './equipmentCatalog';

export interface EquipmentBayProps { selection: EquipmentSelection; onChange: (selection: EquipmentSelection) => void; /** Plays the ship locking and lifting off the pad. */ launching?: boolean }
export default function EquipmentBay({selection,onChange,launching=false}:EquipmentBayProps) {
  const host=useRef<HTMLDivElement>(null), [error,setError]=useState(false), launchedAt=useRef(0);
  useEffect(()=>{launchedAt.current=launching?performance.now():0;},[launching]);
  useEffect(()=>{
    const mount=host.current!;let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{setError(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));mount.append(renderer.domElement);renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Interactive lander equipment preview. Drag to rotate.');
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,100);camera.position.set(9,6,11);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.8,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=8;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.49;
    scene.add(new T.HemisphereLight(0xf2ebe0,0x343442,3));const light=new T.DirectionalLight(0xffd792,5);light.position.set(-5,7,3);scene.add(light);
    const ship=buildLander(selection);
    scene.add(ship.group);
    const platform=new T.Mesh(new T.CylinderGeometry(5.1,5.3,.18,80),new T.MeshStandardMaterial({color:0x1b1c1e,metalness:.6,roughness:.6}));platform.position.y=-.2;scene.add(platform);
    const ring=new T.Mesh(new T.TorusGeometry(4.8,.018,8,100),new T.MeshBasicMaterial({color:0xd6b77c}));ring.rotation.x=-Math.PI/2;ring.position.y=-.09;scene.add(ring);const ringColour=(ring.material as T.MeshBasicMaterial).color;
    const resize=new ResizeObserver(()=>{const w=mount.clientWidth,h=mount.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}});resize.observe(mount);
    let frame=0;const draw=()=>{
      if(launchedAt.current){
        // Launch: the pad clamps let go (a short dip, the ring flashes), then the engine lights and the ship climbs away.
        const t=(performance.now()-launchedAt.current)/1000,rise=Math.max(0,t-.35);
        controls.enabled=false;
        ship.group.position.y=(t<.3?-Math.sin(t/.3*Math.PI)*.14:0)+8*rise*rise+40*rise*rise*rise;
        ship.flame.visible=t>.3;ship.flame.scale.y=Math.min(1.7,(t-.3)*5)*(.9+Math.random()*.2);
        ringColour.setHex(t<.3?0xfff3d0:0xd6b77c);
        controls.target.y=1.8+Math.min(rise*2.2,3.5);
      }
      controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
    return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
  },[selection.vehicleId,selection.landingGearId,selection.hazardSensor]);
  const groups=[{label:'Spacecraft',key:'vehicleId' as const,items:vehicles},{label:'Landing gear',key:'landingGearId' as const,items:landingGear},{label:'Hazard sensor',key:'hazardSensor' as const,items:sensors}];
  return <><div className="equipment-scene" ref={host}>{error&&<p>3D preview unavailable. Equipment controls remain available.</p>}</div><div className="equipment-rails">
    {groups.map(group=>{const index=group.items.findIndex(item=>item.id===selection[group.key]),item=group.items[index];const cycle=(n:number)=>onChange({...selection,[group.key]:group.items[(index+n+group.items.length)%group.items.length].id});return <section className="equipment-rail" key={group.key}><div className="rail-heading"><span>{group.label}</span><span>{index+1} / {group.items.length}</span></div><div className="rail-choice"><button aria-label={`Previous ${group.label.toLowerCase()}`} onClick={()=>cycle(-1)}><ChevronLeft/></button><strong aria-live="polite">{item.name}</strong><button aria-label={`Next ${group.label.toLowerCase()}`} onClick={()=>cycle(1)}><ChevronRight/></button></div><p>{'role' in item&&<>{item.role}<br/></>}{'detail' in item?item.detail:''}</p></section>;})}
    <p className="gear-note">Prototype loadouts. The gear is simulated: stroke and damping set the sink rate it absorbs, stance and leg count set when it tips, and its mass rides along. Trim it on the bridge.</p>
  </div></>;
}
