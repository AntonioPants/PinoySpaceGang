import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { AnalogSite, Body, PlanetarySite, TerrainProfile } from '../../lib/types';
import { earthFlight, earthSurface, globePoint, EARTH_CENTRE, METRE_SCALE, type CameraPose } from './earthSurface';

export interface WorldProps {
  stage: 'title' | 'worlds' | 'destination' | 'earth'; body: Body; hover: Body | null;
  targets: PlanetarySite[]; analogs: AnalogSite[]; targetId: string; analogId: string;
  selectedAnalog: AnalogSite;
  profile: TerrainProfile | null; surface: boolean;
  onBody: (body: Body) => void; onHover: (body: Body | null) => void;
  onTarget: (id: string) => void; onAnalog: (id: string) => void;
}
const centres = { Moon: new T.Vector3(-3.6, .4, 0), Earth: EARTH_CENTRE, Mars: new T.Vector3(5.4, .4, -5) };
// Mars sits about twice as far from Earth as the Moon, and further back. Still staged, not to scale.
const radii = { Moon: .85, Earth: 1.5, Mars: 1.18 };
function release(root: T.Object3D) {
  root.traverse(o => { if (o instanceof T.Mesh || o instanceof T.Points) { o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose()); } });
}

/** One renderer and coordinate system from the three-world overview to a measured Earth patch. */
import { createEarthScenery, type EarthScenery } from "../../lib/earthTileScenery";

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
    camera.position.set(0, 1.4, 10);
    let controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const ambient = new T.AmbientLight(0xe1e5ef, 1.3); scene.add(ambient);
    const haze = new T.FogExp2(0x7b8990, 0), sky = new T.Color(0x030405); scene.fog = haze;
    const sun = new T.DirectionalLight(0xffe3b3, 3); sun.position.set(-5, 5, 8); scene.add(sun, sun.target);
    const planets = new Map<string, T.Mesh>(), textures: T.Texture[] = []; let disposed = false;
    for (const body of ['Moon', 'Earth', 'Mars'] as const) {
      const mat = new T.MeshStandardMaterial({ color: body === 'Mars' ? '#b77050' : '#e2dfd4', roughness: 1 });
      const globe = new T.Mesh(new T.SphereGeometry(radii[body], 96, 64), mat); globe.position.copy(centres[body]); globe.userData.body = body;
      scene.add(globe); planets.set(body, globe);
      if (body !== 'Mars') new T.TextureLoader().load(`/textures/${body.toLowerCase()}.jpg`, texture => {
        if (disposed) { texture.dispose(); return; } texture.colorSpace = T.SRGBColorSpace; texture.wrapS = T.RepeatWrapping; textures.push(texture); mat.map = texture; mat.needsUpdate = true;
        if (body === 'Earth' && terrainMaterial) { terrainMaterial.map = texture; terrainMaterial.needsUpdate = true; }
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
    const starGeo = new T.BufferGeometry(); starGeo.setAttribute('position',new T.BufferAttribute(stars,3)); const starShell = new T.Points(starGeo,new T.PointsMaterial({color:0xc6c1b5,size:.065,sizeAttenuation:true})); scene.add(starShell);
    // Title-screen motion: a second, nearer field of stars streams past the camera, as if the
    // worlds were being approached. It slows on the world overview and stops once a world is chosen.
    const DRIFT = 900, drift = new Float32Array(DRIFT*3); let driftSeed = 4421, driftLevel = 0;
    const driftRandom = () => { driftSeed = (driftSeed * 16807) % 2147483647; return driftSeed / 2147483647; };
    for (let i=0;i<DRIFT;i++) {
      let x = 0, y = 0;
      // Keep the lane through the three worlds clear, so no star flies out of a planet.
      do { x = (driftRandom()*2-1)*46; y = (driftRandom()*2-1)*28; } while (Math.abs(x) < 9 && Math.abs(y) < 3.4);
      drift.set([x, y, 14 - driftRandom()*95], i*3);
    }
    const driftGeo = new T.BufferGeometry(), driftPositions = new T.BufferAttribute(drift,3); driftGeo.setAttribute('position',driftPositions);
    const driftMaterial = new T.PointsMaterial({color:0xf1e9d6,size:.085,sizeAttenuation:true,transparent:true,opacity:0,depthWrite:false,fog:false});
    const driftStars = new T.Points(driftGeo,driftMaterial); driftStars.frustumCulled = false; driftStars.visible = false; scene.add(driftStars);
    const markers = new T.Group(); scene.add(markers);
    let terrain: T.Group | null = null, terrainProfile: TerrainProfile | null = null, terrainMaterial: T.MeshStandardMaterial | null = null;
    const departingPatches: T.Group[] = [];
    let scenery: EarthScenery | undefined;
    let terrainRelief = 0, earthRoute: { from: CameraPose; to: CameraPose; elapsed: number } | null = null;
    let goalTarget = new T.Vector3(), goalOffset = camera.position.clone(), goalUp = new T.Vector3(0,1,0), moving = true, surface = false;
    const fly = (target: T.Vector3, offset: T.Vector3, up = new T.Vector3(0,1,0), onEarth = false) => {
      goalTarget=target; goalOffset=offset; goalUp=up; moving=true; controls.enabled=false;
      const end = target.clone().add(offset);
      // A straight dive takes 2.6 s; a trip to the far side of Earth takes up to 4 s.
      earthRoute = onEarth ? {
        from: { position: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone().normalize() },
        to: { position: end, target, up }, elapsed: 0,
        seconds: 2.6 + 1.4 * camera.position.clone().sub(centres.Earth).angleTo(end.clone().sub(centres.Earth)) / Math.PI,
      } : null;
    };
    const finishFlight = () => {
      moving = false;
      camera.up.copy(goalUp);
      // OrbitControls captures its up-axis in the constructor. Rebind to the local
      // surface normal after flight, using public API, without moving the camera.
      controls.dispose();
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(goalTarget); controls.enableDamping = true; controls.enablePan = false;
      controls.minDistance = surface ? Math.max(900, terrainRelief * 3) * METRE_SCALE : 2;
      controls.maxDistance = surface ? .004 : Math.max(22, goalOffset.length()*1.1);
      controls.maxPolarAngle = surface ? Math.PI * .42 : Math.PI;
      controls.enabled = !['worlds','title'].includes(live.current.stage);
      departingPatches.splice(0).forEach(patch => { scene.remove(patch); release(patch); });
    };
    update.current = () => {
      const p = live.current; surface = p.stage === 'earth' && p.surface && !!p.profile;
      release(markers); markers.clear();
      const points = p.stage === 'destination' ? p.targets.filter(t=>t.body===p.body) : p.stage === 'earth' && !surface ? p.analogs : [];
      const body = p.stage === 'destination' ? p.body : 'Earth';
      for (const point of points) {
        const marker = new T.Mesh(new T.SphereGeometry(.034,12,10),new T.MeshBasicMaterial({color:point.id === (p.stage==='earth'?p.analogId:p.targetId) ? 0xe9c78a : 0xffffff}));
        marker.position.copy(globePoint(point.lat,point.lon,radii[body]+.018).add(centres[body])); marker.userData.id=point.id; markers.add(marker);
      }
      if (p.profile && p.profile !== terrainProfile) {
        // Keep the departing ground under the camera until the next site flight
        // finishes. Replacing a pack must not reveal the coarse sphere beneath it.
        scenery?.dispose(); scenery = undefined;
        if (terrain) departingPatches.push(terrain);
        terrain=null; terrainMaterial=null; terrainProfile=p.profile;
        if (p.profile) {
          const site=p.selectedAnalog.id===p.profile.manifest.id?p.selectedAnalog:undefined;
          if (site) {
            const patch = earthSurface(p.profile, site.lat, site.lon);
            terrainRelief = patch.relief;
            terrainMaterial = new T.MeshStandardMaterial({ color: '#e2dfd4', roughness: 1, vertexColors: true, map: (planets.get('Earth')!.material as T.MeshStandardMaterial).map });
            const measuredMesh = new T.Mesh(patch.geometry, terrainMaterial);
            terrain=new T.Group(); terrain.add(measuredMesh);
            terrain.quaternion.copy(patch.frame); terrain.position.copy(globePoint(site.lat,site.lon,1.5).add(centres.Earth));terrain.scale.setScalar(METRE_SCALE);scene.add(terrain);
            if (import.meta.env.VITE_CESIUM_ION_TOKEN) {
              const { rows, columns, spacing_m } = p.profile.manifest.grid;
              const w = (columns-1)*spacing_m/2, d = (rows-1)*spacing_m/2;
              terrain.updateMatrixWorld();
              scenery = createEarthScenery(renderer, host, site.lat, site.lon, patch.baseHeight,
                terrain.matrixWorld, patch.geometry, { west:-w,east:w,north:-d,south:d }, haze.color, [measuredMesh]);
            }
          }
        }
      }
      if(terrain)terrain.visible=p.stage==='earth';
      departingPatches.forEach(patch => { patch.visible = p.stage==='earth'; });
      controls.minDistance=surface ? Math.max(900, terrainRelief * 3) * METRE_SCALE : 2;controls.maxDistance=surface ? .004 : 22;
      controls.maxPolarAngle = surface ? Math.PI * .42 : Math.PI;
      sun.position.set(-5,5,8);sun.target.position.set(0,0,0);
      if(surface && terrain) {
        const offset=new T.Vector3(2000,1300 + terrainRelief*.5,3200).applyQuaternion(terrain.quaternion).multiplyScalar(METRE_SCALE);
        fly(terrain.position.clone(),offset,new T.Vector3(0,1,0).applyQuaternion(terrain.quaternion),true);
      } else if(p.stage==='earth' && p.surface) {
        // The site's terrain is still loading. Wait directly above it, so the descent that
        // follows carries straight on down instead of starting again from a side-on orbit.
        const site=p.selectedAnalog;
        fly(globePoint(site.lat,site.lon,radii.Earth).add(centres.Earth),globePoint(site.lat,site.lon,2.2),new T.Vector3(0,1,0),true);
      } else if(p.stage==='title') {
        fly(new T.Vector3(0,.1,0),new T.Vector3(0,1.4,10).multiplyScalar(Math.max(1,1.45/camera.aspect)));
      } else if(p.stage==='worlds') {
        fly(p.hover?centres[p.hover].clone().multiplyScalar(.35):new T.Vector3(),new T.Vector3(0,2,p.hover?11:14).multiplyScalar(Math.max(1,1.1/camera.aspect)));
      } else {
        const selected=p.stage==='earth'?p.selectedAnalog:p.targets.find(t=>t.id===p.targetId);
        const offset=selected?globePoint(selected.lat*.8,selected.lon,p.stage==='earth'?5.5:3.8):new T.Vector3(0,1,4.5);
        offset.multiplyScalar(Math.max(1,.85/camera.aspect));
        fly(centres[body].clone(),offset,new T.Vector3(0,1,0),p.stage==='earth');
      }
    }; update.current();
    const ray=new T.Raycaster(); let down={x:0,y:0};
    const hit=(e:PointerEvent) => {const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);return ray.intersectObjects([...planets.values(),...markers.children],false)[0]?.object;};
    const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;const obj=hit(e),p=live.current;if(p.stage==='worlds' && ['Moon','Mars'].includes(obj?.userData.body))p.onBody(obj!.userData.body);else if(obj?.userData.id){if(p.stage==='earth')p.onAnalog(obj.userData.id);else p.onTarget(obj.userData.id);}};
    const pointerMove=(e:PointerEvent)=>{const obj=hit(e);renderer.domElement.style.cursor=obj?.userData.id||['Moon','Mars'].includes(obj?.userData.body)?'pointer':'grab';if(live.current.stage==='worlds'&&['Moon','Mars'].includes(obj?.userData.body)&&live.current.hover!==obj?.userData.body)live.current.onHover(obj!.userData.body);};
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointermove',pointerMove);
    const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(!surface)update.current();}});resize.observe(host);
    let frame=0,last=performance.now();
    const render=()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
      if (earthRoute) {
        earthRoute.elapsed += dt;
        const progress = reduced.matches ? 1 : Math.min(earthRoute.elapsed / earthRoute.seconds, 1);
        const pose = earthFlight(earthRoute.from, earthRoute.to, progress);
        camera.position.copy(pose.position); camera.up.copy(pose.up); controls.target.copy(pose.target); camera.lookAt(pose.target);
        if (progress === 1) { earthRoute = null; finishFlight(); }
      } else if(moving){const a=reduced.matches?1:1-Math.exp(-4*dt);controls.target.lerp(goalTarget,a);camera.up.lerp(goalUp,a).normalize();const off=camera.position.clone().sub(controls.target);const distance=Math.exp(T.MathUtils.lerp(Math.log(Math.max(off.length(),.000001)),Math.log(goalOffset.length()),a));off.normalize().lerp(goalOffset.clone().normalize(),a).normalize().multiplyScalar(distance);camera.position.copy(controls.target).add(off);camera.lookAt(controls.target);if(camera.position.distanceTo(goalTarget.clone().add(goalOffset))<goalOffset.length()*.002){camera.position.copy(goalTarget).add(goalOffset);controls.target.copy(goalTarget);finishFlight();}}
      const driftGoal = live.current.stage==='title' ? 1 : live.current.stage==='worlds' ? .3 : 0;
      driftLevel += (driftGoal - driftLevel) * (1 - Math.exp(-2.2*dt));
      driftStars.visible = driftLevel > .01; driftMaterial.opacity = Math.min(1, driftLevel*3) * .9;
      if (driftStars.visible && !reduced.matches) {
        // Each star keeps its own speed, so nearer ones overtake: depth without moving the camera.
        for (let i=0;i<DRIFT;i++) { let z = drift[i*3+2] + (1.4 + (i%7)*.55) * driftLevel * dt; if (z > 14) z -= 95; drift[i*3+2] = z; }
        driftPositions.needsUpdate = true;
      }
      if (!reduced.matches) starShell.rotation.y += dt * .004;
      // Earth and its horizon stay present at every altitude; no globe/terrain swap.
      for(const [body,mesh] of planets)mesh.visible=!surface||body==='Earth';
      const nearGround = terrain && live.current.stage === 'earth' ? 1 - T.MathUtils.smoothstep(camera.position.distanceTo(centres.Earth) - radii.Earth, .002, .025) : 0;
      haze.density = nearGround * 160;
      scene.background = nearGround > 0 ? sky.set(0x030405).lerp(haze.color, nearGround) : null;
      ambient.intensity = T.MathUtils.lerp(1.3, .65, nearGround);
      if (terrain) {
        const localSun = new T.Vector3(-4000,5000,1500).applyQuaternion(terrain.quaternion).multiplyScalar(METRE_SCALE).add(terrain.position);
        sun.position.set(-5,5,8).lerp(localSun, nearGround); sun.target.position.set(0,0,0).lerp(terrain.position, nearGround);
      }
      if(!moving)controls.update();
      const streamed = surface && scenery?.draw(camera);
      if (streamed) { planets.get('Earth')!.visible = false; scene.background = null; renderer.autoClear = false; }
      renderer.render(scene,camera); renderer.autoClear = true;frame=requestAnimationFrame(render);};render();
    return()=>{disposed=true;scenery?.dispose();cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointermove',pointerMove);textures.forEach(t=>t.dispose());release(scene);renderer.dispose();renderer.domElement.remove();update.current=()=>{};};
  },[]);
  useEffect(()=>update.current(),[props.stage,props.body,props.hover,props.targetId,props.analogId,props.profile,props.surface,props.analogs,props.targets]);
  return <div className="opening-world-scene" ref={mount}>{error&&<p className="scene-unavailable">3D graphics are unavailable. Use the destination and site controls to continue.</p>}</div>;
}
