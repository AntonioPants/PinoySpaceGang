import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildLander } from '../../components/cutscene/lander';
import { landingGear, sensors, vehicles, type EquipmentSelection } from './equipmentCatalog';

export interface EquipmentBayProps { selection: EquipmentSelection; onChange: (selection: EquipmentSelection) => void }
export default function EquipmentBay({selection,onChange}:EquipmentBayProps) {
  const host=useRef<HTMLDivElement>(null), [error,setError]=useState(false);
  useEffect(()=>{
    const mount=host.current!;let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{setError(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));mount.append(renderer.domElement);renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','Interactive lander equipment preview. Drag to rotate.');
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,100);camera.position.set(9,6,11);
    const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.8,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=8;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.49;
    scene.add(new T.HemisphereLight(0xf2ebe0,0x343442,3));const light=new T.DirectionalLight(0xffd792,5);light.position.set(-5,7,3);scene.add(light);
    const ship=buildLander(), gear=landingGear.find(g=>g.id===selection.landingGearId)!;
    const oldLegs=ship.group.children.slice(3,15);oldLegs.forEach(o=>{ship.group.remove(o);if(o instanceof T.Mesh)o.geometry.dispose();});
    const mat=new T.MeshStandardMaterial({color:0xd8d6cf,metalness:.65,roughness:.35});
    const count=gear.id==='survey-six'?6:4;
    for(let i=0;i<count;i++){const a=Math.PI/4+i*Math.PI*2/count,foot=new T.Vector3(Math.cos(a)*gear.radius,.1,Math.sin(a)*gear.radius);
      for(const y of [1.6,2.6]){const top=new T.Vector3(Math.cos(a)*1.5,y,Math.sin(a)*1.5),d=foot.clone().sub(top),leg=new T.Mesh(new T.CylinderGeometry(.065,.065,d.length(),8),mat);leg.position.copy(top).add(foot).multiplyScalar(.5);leg.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());ship.group.add(leg);}
      const pad=new T.Mesh(new T.CylinderGeometry(gear.pad,gear.pad,.12,16),mat);pad.position.copy(foot);ship.group.add(pad);
    }
    const sensor=new T.Mesh(selection.hazardSensor==='camera'?new T.BoxGeometry(.5,.35,.4):new T.CylinderGeometry(.22,.22,.4,16),new T.MeshStandardMaterial({color:0xa7c2c4,emissive:0x254548,metalness:.7,roughness:.2}));sensor.position.set(0,3.5,1.1);sensor.visible=selection.hazardSensor!=='none';ship.group.add(sensor);
    if(selection.vehicleId==='payload')ship.group.children[0].scale.y=1.25;
    scene.add(ship.group);
    const platform=new T.Mesh(new T.CylinderGeometry(5.1,5.3,.18,80),new T.MeshStandardMaterial({color:0x1b1c1e,metalness:.6,roughness:.6}));platform.position.y=-.2;scene.add(platform);
    const ring=new T.Mesh(new T.TorusGeometry(4.8,.018,8,100),new T.MeshBasicMaterial({color:0xd6b77c}));ring.rotation.x=-Math.PI/2;ring.position.y=-.09;scene.add(ring);
    const resize=new ResizeObserver(()=>{const w=mount.clientWidth,h=mount.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}});resize.observe(mount);
    let frame=0;const draw=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
    return()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
  },[selection.vehicleId,selection.landingGearId,selection.hazardSensor]);
  const groups=[{label:'Spacecraft',key:'vehicleId' as const,items:vehicles},{label:'Landing gear',key:'landingGearId' as const,items:landingGear},{label:'Hazard sensor',key:'hazardSensor' as const,items:sensors}];
  return <><div className="equipment-scene" ref={host}>{error&&<p>3D preview unavailable. Equipment controls remain available.</p>}</div><div className="equipment-rails">
    {groups.map(group=>{const index=group.items.findIndex(item=>item.id===selection[group.key]),item=group.items[index];const cycle=(n:number)=>onChange({...selection,[group.key]:group.items[(index+n+group.items.length)%group.items.length].id});return <section className="equipment-rail" key={group.key}><div className="rail-heading"><span>{group.label}</span><span>{index+1} / {group.items.length}</span></div><div className="rail-choice"><button aria-label={`Previous ${group.label.toLowerCase()}`} onClick={()=>cycle(-1)}><ChevronLeft/></button><strong aria-live="polite">{item.name}</strong><button aria-label={`Next ${group.label.toLowerCase()}`} onClick={()=>cycle(1)}><ChevronRight/></button></div><p>{'detail' in item?item.detail:''}</p></section>;})}
    <p className="gear-note">Prototype loadouts. Gear shapes are visual previews; gear-specific physics is not yet simulated.</p>
  </div></>;
}
