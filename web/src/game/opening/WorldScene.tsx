import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { AnalogSite, Body, PlanetarySite, TerrainProfile } from '../../lib/types';

export interface WorldProps {
  stage: 'worlds' | 'destination' | 'earth'; body: Body; hover: Body | null;
  targets: PlanetarySite[]; analogs: AnalogSite[]; targetId: string; analogId: string;
  profile: TerrainProfile | null; surface: boolean;
  onBody: (body: Body) => void; onHover: (body: Body | null) => void;
  onTarget: (id: string) => void; onAnalog: (id: string) => void;
}
const centres = { Moon: new T.Vector3(-3.6, .4, 0), Earth: new T.Vector3(0, -.35, 0), Mars: new T.Vector3(3.7, .1, 0) };
const radii = { Moon: .85, Earth: 1.5, Mars: 1.18 };
export function globePoint(lat: number, lon: number, radius: number) {
  const p = T.MathUtils.degToRad(90 - lat), t = T.MathUtils.degToRad(lon + 180);
  return new T.Vector3(-radius * Math.sin(p) * Math.cos(t), radius * Math.cos(p), radius * Math.sin(p) * Math.sin(t));
}
function release(root: T.Object3D) {
  root.traverse(o => { if (o instanceof T.Mesh || o instanceof T.Points) { o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose()); } });
}

/** One renderer and coordinate system from the three-world overview to a measured Earth patch. */
export default function WorldScene(props: WorldProps) {
  const mount = useRef<HTMLDivElement>(null), live = useRef(props), update = useRef<() => void>(() => {});
  const [error, setError] = useState(false); live.current = props;
  useEffect(() => {
    const host = mount.current!; let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true }); } catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); host.append(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Mission worlds. Select a destination or site using the scene or the adjacent buttons.');
    renderer.domElement.setAttribute('role', 'img');
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(42, 1, .000001, 300);
    camera.position.set(0, 3, 14);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    scene.add(new T.AmbientLight(0xe1e5ef, 1.3));
    const sun = new T.DirectionalLight(0xffe3b3, 3); sun.position.set(-5, 5, 8); scene.add(sun, sun.target);
    const planets = new Map<string, T.Mesh>(), textures: T.Texture[] = []; let disposed = false;
    for (const body of ['Moon', 'Earth', 'Mars'] as const) {
      const mat = new T.MeshStandardMaterial({ color: body === 'Mars' ? '#b77050' : '#e2dfd4', roughness: 1 });
      const globe = new T.Mesh(new T.SphereGeometry(radii[body], 96, 64), mat); globe.position.copy(centres[body]); globe.userData.body = body;
      scene.add(globe); planets.set(body, globe);
      if (body !== 'Mars') new T.TextureLoader().load(`/textures/${body.toLowerCase()}.jpg`, texture => {
        if (disposed) { texture.dispose(); return; } texture.colorSpace = T.SRGBColorSpace; textures.push(texture); mat.map = texture; mat.needsUpdate = true;
      });
      else {
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512; const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ac7457'; ctx.fillRect(0,0,1024,512); let seed = 91;
        const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let i=0;i<7000;i++) { ctx.fillStyle = `rgba(${i%2 ? '42,23,18' : '223,177,128'},${random()*.15})`; ctx.beginPath(); ctx.ellipse(random()*1024,random()*512,random()*24+1,random()*9+1,0,0,Math.PI*2); ctx.fill(); }
        const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; mat.map = texture; textures.push(texture);
      }
    }
    const stars = new Float32Array(1200*3);
    for (let i=0;i<1200;i++) { const a=i*2.39996, z=1-2*(i+.5)/1200, r=Math.sqrt(1-z*z)*90; stars.set([Math.cos(a)*r,z*90,Math.sin(a)*r],i*3); }
    const starGeo = new T.BufferGeometry(); starGeo.setAttribute('position',new T.BufferAttribute(stars,3)); scene.add(new T.Points(starGeo,new T.PointsMaterial({color:0xc6c1b5,size:.065,sizeAttenuation:true})));
    const markers = new T.Group(); scene.add(markers);
    let terrain: T.Group | null = null, terrainProfile: TerrainProfile | null = null;
    let goalTarget = new T.Vector3(), goalOffset = camera.position.clone(), goalUp = new T.Vector3(0,1,0), moving = true, surface = false;
    const fly = (target: T.Vector3, offset: T.Vector3, up = new T.Vector3(0,1,0)) => { goalTarget=target; goalOffset=offset; goalUp=up; moving=true; controls.enabled=false; };
    const scale = 1.5 / 6371000; // The Earth patch uses metres on the same globe.
    update.current = () => {
      const p = live.current; surface = p.stage === 'earth' && p.surface && !!p.profile;
      release(markers); markers.clear();
      const points = p.stage === 'destination' ? p.targets.filter(t=>t.body===p.body) : p.stage === 'earth' && !surface ? p.analogs : [];
      const body = p.stage === 'destination' ? p.body : 'Earth';
      for (const point of points) {
        const marker = new T.Mesh(new T.SphereGeometry(.034,12,10),new T.MeshBasicMaterial({color:point.id === (p.stage==='earth'?p.analogId:p.targetId) ? 0xe9c78a : 0xffffff}));
        marker.position.copy(globePoint(point.lat,point.lon,radii[body]+.018).add(centres[body])); marker.userData.id=point.id; markers.add(marker);
      }
      if (p.profile !== terrainProfile) {
        if (terrain) { scene.remove(terrain); release(terrain); } terrain=null; terrainProfile=p.profile;
        if (p.profile) {
          const site=p.analogs.find(a=>a.id===p.profile!.manifest.id);
          if (site) {
            const {rows,columns,spacing_m:s}=p.profile.manifest.grid, values=new DataView(p.profile.buffer);
            const pos=new Float32Array(rows*columns*3), colors=new Float32Array(rows*columns*3), indices:number[]=[];
            let low=Infinity, high=-Infinity; for(let i=0;i<rows*columns;i++){const h=values.getFloat32(i*4,true);low=Math.min(low,h);high=Math.max(high,h);}
            const cold=/haughton|barrow/.test(site.id), dark=new T.Color(cold?'#718086':'#695c42'), light=new T.Color(cold?'#dfe5df':'#c6af7d');
            for(let r=0;r<rows;r++)for(let c=0;c<columns;c++) { const i=r*columns+c,h=values.getFloat32(i*4,true); pos.set([(c-(columns-1)/2)*s,(h-low),(r-(rows-1)/2)*s],i*3); const col=dark.clone().lerp(light,(h-low)/(high-low||1)); colors.set([col.r,col.g,col.b],i*3); if(r<rows-1&&c<columns-1)indices.push(i,i+columns,i+1,i+1,i+columns,i+columns+1); }
            const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
            terrain=new T.Group(); const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));terrain.add(mesh);
            // Local x east, y up, z south, aligned to the selected geographic point.
            const normal=globePoint(site.lat,site.lon,1), east=globePoint(0,site.lon+90,1), south=new T.Vector3().crossVectors(east,normal);
            terrain.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(east,normal,south)); terrain.position.copy(normal.multiplyScalar(1.5).add(centres.Earth));terrain.scale.setScalar(scale);scene.add(terrain);
          }
        }
      }
      if(terrain)terrain.visible=surface;
      controls.minDistance=surface ? .0001 : 2;controls.maxDistance=surface ? .004 : 22;
      sun.position.set(-5,5,8);sun.target.position.set(0,0,0);
      if(surface && terrain) {
        sun.position.copy(terrain.position).add(new T.Vector3(-4000,6000,2000).applyQuaternion(terrain.quaternion).multiplyScalar(scale));sun.target.position.copy(terrain.position);
        const offset=new T.Vector3(4200,3200,4900).applyQuaternion(terrain.quaternion).multiplyScalar(scale);
        fly(terrain.position.clone(),offset,new T.Vector3(0,1,0).applyQuaternion(terrain.quaternion));
      } else if(p.stage==='worlds') {
        fly(p.hover?centres[p.hover].clone().multiplyScalar(.35):new T.Vector3(),new T.Vector3(0,2,p.hover?11:14));
      } else {
        const selected=p.stage==='earth'?p.analogs.find(a=>a.id===p.analogId):p.targets.find(t=>t.id===p.targetId);
        const offset=selected?globePoint(selected.lat*.8,selected.lon,p.stage==='earth'?5.5:3.8):new T.Vector3(0,1,4.5);
        fly(centres[body].clone(),offset);
      }
    }; update.current();
    const ray=new T.Raycaster(); let down={x:0,y:0};
    const hit=(e:PointerEvent) => {const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);return ray.intersectObjects([...planets.values(),...markers.children],false)[0]?.object;};
    const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const obj=hit(e),p=live.current;if(p.stage==='worlds' && ['Moon','Mars'].includes(obj?.userData.body))p.onBody(obj!.userData.body);else if(obj?.userData.id){if(p.stage==='earth')p.onAnalog(obj.userData.id);else p.onTarget(obj.userData.id);}};
    const pointerMove=(e:PointerEvent)=>{const obj=hit(e);renderer.domElement.style.cursor=obj?.userData.id||['Moon','Mars'].includes(obj?.userData.body)?'pointer':'grab';if(live.current.stage==='worlds'&&['Moon','Mars'].includes(obj?.userData.body)&&live.current.hover!==obj?.userData.body)live.current.onHover(obj!.userData.body);};
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointermove',pointerMove);
    const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}});resize.observe(host);
    let frame=0,last=performance.now();
    const render=()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
      if(moving){const a=reduced.matches?1:1-Math.exp(-4*dt);controls.target.lerp(goalTarget,a);camera.up.lerp(goalUp,a).normalize();const off=camera.position.clone().sub(controls.target);const distance=Math.exp(T.MathUtils.lerp(Math.log(Math.max(off.length(),.000001)),Math.log(goalOffset.length()),a));off.normalize().lerp(goalOffset.clone().normalize(),a).normalize().multiplyScalar(distance);camera.position.copy(controls.target).add(off);camera.lookAt(controls.target);if(camera.position.distanceTo(goalTarget.clone().add(goalOffset))<goalOffset.length()*.002){camera.position.copy(goalTarget).add(goalOffset);controls.target.copy(goalTarget);moving=false;controls.enabled=live.current.stage!=='worlds';}}
      for(const [body,mesh] of planets)mesh.visible=!(surface&&camera.position.distanceTo(goalTarget)<.025)&&(!surface||body==='Earth');
      if(!moving)controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(render);};render();
    return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointermove',pointerMove);textures.forEach(t=>t.dispose());release(scene);renderer.dispose();renderer.domElement.remove();update.current=()=>{};};
  },[]);
  useEffect(()=>update.current(),[props.stage,props.body,props.hover,props.targetId,props.analogId,props.profile,props.surface,props.analogs,props.targets]);
  return <div className="opening-world-scene" ref={mount}>{error&&<p className="scene-unavailable">3D graphics are unavailable. Use the destination and site controls to continue.</p>}</div>;
}
