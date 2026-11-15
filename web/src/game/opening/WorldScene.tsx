import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { AnalogSite, Body, PlanetarySite, TerrainProfile } from '../../lib/types';
import type { LandingPoint } from '../../lib/landing';
import { earthFlight, earthSurface, elevationOver, globePoint, siteSwoop, EARTH_CENTRE, METRE_SCALE, type CameraPose } from './earthSurface';
import { paintRegion, regionPatch } from './regions';
import { buildLandingPicker, type LandingPicker } from './landingPick';
import { buildTitleFlight, LAUNCH_SECONDS } from './titleFlight';
import { createEarthScenery, type EarthScenery } from '../../lib/earthTileScenery';

export interface WorldProps {
  stage: 'title' | 'worlds' | 'destination' | 'earth'; body: Body; hover: Body | null;
  targets: PlanetarySite[]; analogs: AnalogSite[]; targetId: string; analogId: string;
  selectedAnalog: AnalogSite;
  profile: TerrainProfile | null; surface: boolean;
  /** A site the pointer is over in the list beside the scene; its region lights up here too. */
  hoverSite: string | null;
  /** The landing point flagged on the terrain (x east, y north, metres from the patch centre). */
  landing: LandingPoint;
  onBody: (body: Body) => void; onHover: (body: Body | null) => void;
  onTarget: (id: string) => void; onAnalog: (id: string) => void;
  onHoverSite: (id: string | null) => void; onLanding: (point: LandingPoint) => void;
  /** The flight in from the title has settled enough for the world screen's text to appear. */
  onArrived?: () => void;
}
const centres = { Moon: new T.Vector3(-3.6, .4, 0), Earth: EARTH_CENTRE, Mars: new T.Vector3(5.4, .4, -5) };
// Mars sits about twice as far from Earth as the Moon, and further back. Still staged, not to scale.
const radii = { Moon: .85, Earth: 1.5, Mars: 1.18 };
/** Half-width of a site's region outline, in degrees on its globe. Enlarged to be seen: see regions.ts. */
const REGION_DEG = { Moon: 5.5, Mars: 5.5, Earth: 2.6 };
/** Where the title's camera rides, far out and off to one side of the worlds, and how long the flight in takes. */
const TITLE_POSITION = new T.Vector3(-26, 11, 66), ARRIVAL_SECONDS = 5.6;
/** The title looks a little below the worlds, so their bright point sits above the ship and the lettering. */
const TITLE_AIM = new T.Vector3(0, -10, 0);
const UP = new T.Vector3(0, 1, 0);

function release(root: T.Object3D) {
  root.traverse(o => { if (o instanceof T.Mesh || o instanceof T.Points || o instanceof T.Line || o instanceof T.Sprite) { o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; materials.forEach(m => m.dispose()); } });
}
/**
 * A thin glowing rim around a world, brightest at its limb. Illustrative, not a modelled atmosphere.
 * It never takes a pointer hit, so clicks at a world's edge still reach the world.
 */
function atmosphere(radius: number, colour: number, strength: number) {
  const material = new T.ShaderMaterial({
    uniforms: { colour: { value: new T.Color(colour) }, strength: { value: strength } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying float vRim;
      void main(){ vec4 view = modelViewMatrix * vec4(position, 1.); vec3 n = normalize(normalMatrix * normal);
        vRim = 1. - abs(dot(n, normalize(-view.xyz))); gl_Position = projectionMatrix * view;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <logdepthbuf_pars_fragment>
      uniform vec3 colour; uniform float strength; varying float vRim;
      void main(){
        #include <logdepthbuf_fragment>
        float glow = pow(vRim, 3.) * strength; gl_FragColor = vec4(colour * glow, glow); }`,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  });
  const shell = new T.Mesh(new T.SphereGeometry(radius * 1.045, 64, 40), material);
  shell.raycast = () => {}; return shell;
}
/** Overshoot a little and settle: a world swelling into view. */
const easeOutBack = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
/** When each world appears during the arrival: Earth first, then the Moon, then Mars. */
const REVEAL_AT = { Earth: .3, Moon: .37, Mars: .44 };
type Route =
  | { kind: 'orbit' | 'swoop'; from: CameraPose; to: CameraPose; pivot: T.Vector3; elapsed: number; seconds: number; next?: () => void }
  | { kind: 'arrival'; from: CameraPose; to: CameraPose; elapsed: number; seconds: number };

/** One renderer and coordinate system from the title's flight to the three worlds to a measured Earth patch. */
export default function WorldScene(props: WorldProps) {
  const mount = useRef<HTMLDivElement>(null), live = useRef(props), update = useRef<() => void>(() => {});
  const paint = useRef<() => void>(() => {}), plant = useRef<() => void>(() => {});
  const [error, setError] = useState(false); live.current = props;
  useEffect(() => {
    const host = mount.current!; let renderer: T.WebGLRenderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true }); } catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); host.append(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Mission worlds. Select a destination or site using the scene or the adjacent buttons.');
    renderer.domElement.setAttribute('role', 'img');
    // The burst of light as the ship drops out of its run and the worlds appear.
    const flash = document.createElement('div'); flash.className = 'arrival-flash'; host.append(flash);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(42, 1, .000001, 300);
    camera.position.copy(TITLE_POSITION); scene.add(camera);
    let controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.enablePan = false; controls.enabled = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const ambient = new T.AmbientLight(0xe1e5ef, 1.3); scene.add(ambient);
    const haze = new T.FogExp2(0x7b8990, 0), sky = new T.Color(0x030405); scene.fog = haze;
    const sun = new T.DirectionalLight(0xffe3b3, 3); sun.position.set(-5, 5, 8); scene.add(sun, sun.target);
    const planets = new Map<Body | 'Earth', T.Mesh>(), atmospheres = new Map<Body | 'Earth', T.Mesh>(), textures: T.Texture[] = []; let disposed = false;
    for (const body of ['Moon', 'Earth', 'Mars'] as const) {
      // The emissive map is the surface itself: raising its intensity brightens a hovered world evenly.
      const mat = new T.MeshStandardMaterial({ color: body === 'Mars' ? '#b77050' : '#e2dfd4', roughness: 1, emissive: 0xffffff, emissiveIntensity: 0 });
      const globe = new T.Mesh(new T.SphereGeometry(radii[body], 96, 64), mat); globe.position.copy(centres[body]); globe.userData.body = body;
      if (body !== 'Moon') { const air = atmosphere(radii[body], body === 'Earth' ? 0x6fb4ff : 0xe8a070, body === 'Earth' ? .75 : .55); globe.add(air); atmospheres.set(body, air); }
      scene.add(globe); planets.set(body, globe);
      if (body !== 'Mars') new T.TextureLoader().load(`/textures/${body.toLowerCase()}.jpg`, texture => {
        if (disposed) { texture.dispose(); return; } texture.colorSpace = T.SRGBColorSpace; texture.wrapS = T.RepeatWrapping; textures.push(texture); mat.map = texture; mat.emissiveMap = texture; mat.needsUpdate = true;
        if (body === 'Earth' && terrainMaterial) { terrainMaterial.map = texture; terrainMaterial.needsUpdate = true; }
      });
      else {
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512; const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ac7457'; ctx.fillRect(0,0,1024,512); let seed = 91;
        const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let i=0;i<7000;i++) { ctx.fillStyle = `rgba(${i%2 ? '42,23,18' : '223,177,128'},${random()*.15})`; ctx.beginPath(); ctx.ellipse(random()*1024,random()*512,random()*24+1,random()*9+1,0,0,Math.PI*2); ctx.fill(); }
        const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; mat.map = texture; mat.emissiveMap = texture; textures.push(texture);
      }
    }
    const stars = new Float32Array(1200*3);
    for (let i=0;i<1200;i++) { const a=i*2.39996, z=1-2*(i+.5)/1200, r=Math.sqrt(1-z*z)*90; stars.set([Math.cos(a)*r,z*90,Math.sin(a)*r],i*3); }
    const starGeo = new T.BufferGeometry(); starGeo.setAttribute('position',new T.BufferAttribute(stars,3));
    const starShell = new T.Points(starGeo,new T.PointsMaterial({color:0xc6c1b5,size:.065,sizeAttenuation:true})); scene.add(starShell);
    const title = buildTitleFlight(); camera.add(title.rig); scene.add(title.beacon); textures.push(...title.textures);
    const markers = new T.Group(); scene.add(markers);
    let terrain: T.Group | null = null, terrainProfile: TerrainProfile | null = null, terrainMaterial: T.MeshStandardMaterial | null = null;
    let picker: LandingPicker | null = null, lastSite: T.Vector3 | null = null;
    const departingPatches: T.Group[] = [];
    let scenery: EarthScenery | undefined;
    let terrainRelief = 0, route: Route | null = null, stage: WorldProps['stage'] | null = null;
    let goalTarget = new T.Vector3(), goalOffset = camera.position.clone(), goalUp = UP.clone(), moving = true, surface = false;
    /** 0 while the worlds are still out of sight on the title, 1 once they are in view. */
    let reveal = 0, hoverSite: string | null = null, arrived = false;
    const glow = { Moon: 0, Mars: 0 };
    const pose = (): CameraPose => ({ position: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone().normalize() });
    const aim = (target: T.Vector3, offset: T.Vector3, up: T.Vector3) => { goalTarget = target; goalOffset = offset; goalUp = up; moving = true; controls.enabled = false; };
    /** Ease towards a pose: used between the worlds and for the globes. */
    const fly = (target: T.Vector3, offset: T.Vector3, up = UP.clone()) => { aim(target, offset, up); route = null; };
    /** Fly over Earth to a pose, staying above the sphere. A straight trip takes 2.6 s; one to the far side up to 4 s. */
    const orbitTo = (to: CameraPose, next?: () => void) => {
      aim(to.target, to.position.clone().sub(to.target), to.up);
      const from = pose();
      route = { kind: 'orbit', from, to, pivot: to.target, elapsed: 0, next,
        seconds: 2.6 + 1.4 * from.position.clone().sub(centres.Earth).angleTo(to.position.clone().sub(centres.Earth)) / Math.PI };
    };
    /** Swing around a surface site, down to it or up from it. Longer for a bigger change of altitude. */
    const swoopTo = (to: CameraPose, pivot: T.Vector3) => {
      aim(to.target, to.position.clone().sub(to.target), to.up);
      const from = pose(), ratio = from.position.distanceTo(pivot) / Math.max(to.position.distanceTo(pivot), 1e-9);
      route = { kind: 'swoop', from, to, pivot, elapsed: 0, seconds: T.MathUtils.clamp(2.1 + .15 * Math.abs(Math.log(ratio)), 2.1, 4) };
    };
    const limits = () => {
      const reach = goalOffset.length();
      // A tall landscape must not push the camera back out once it has arrived.
      controls.minDistance = surface ? Math.min(Math.max(900, terrainRelief * 3) * METRE_SCALE, reach * .6) : 2;
      controls.maxDistance = surface ? Math.max(.004, reach * 1.2) : Math.max(22, reach * 1.1);
      controls.maxPolarAngle = surface ? Math.PI * .42 : Math.PI;
    };
    const finishFlight = () => {
      moving = false; route = null;
      camera.up.copy(goalUp);
      // OrbitControls captures its up-axis in the constructor. Rebind to the local
      // surface normal after flight, using public API, without moving the camera.
      controls.dispose();
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(goalTarget); controls.enableDamping = true; controls.enablePan = false;
      limits();
      controls.enabled = !['worlds','title'].includes(live.current.stage);
      departingPatches.splice(0).forEach(patch => { scene.remove(patch); release(patch); });
    };
    paint.current = () => {
      const p = live.current, chosen = p.stage === 'earth' ? p.analogId : p.targetId;
      for (const region of markers.children) {
        const id = region.userData.id;
        paintRegion(region, id === hoverSite || id === p.hoverSite ? 'hover' : id === chosen ? 'selected' : 'idle');
      }
    };
    plant.current = () => picker?.setFlag(live.current.landing);
    update.current = () => {
      const p = live.current, previous = stage; stage = p.stage;
      surface = p.stage === 'earth' && p.surface && !!p.profile;
      release(markers); markers.clear();
      const points = p.stage === 'destination' ? p.targets.filter(t=>t.body===p.body) : p.stage === 'earth' && !surface ? p.analogs : [];
      const body = p.stage === 'destination' ? p.body : 'Earth';
      for (const point of points) {
        const region = regionPatch(point.id, point.lat, point.lon, radii[body], REGION_DEG[body]);
        region.position.copy(centres[body]); markers.add(region);
      }
      if (hoverSite && !points.some(point => point.id === hoverSite)) { hoverSite = null; p.onHoverSite(null); }
      paint.current();
      if (p.profile && p.profile !== terrainProfile) {
        // Keep the departing ground under the camera until the next site flight
        // finishes. Replacing a pack must not reveal the coarse sphere beneath it.
        scenery?.dispose(); scenery = undefined;
        if (terrain) departingPatches.push(terrain);
        terrain=null; terrainMaterial=null; picker=null; terrainProfile=p.profile;
        const site=p.selectedAnalog.id===p.profile.manifest.id?p.selectedAnalog:undefined;
        if (site) {
          const patch = earthSurface(p.profile, site.lat, site.lon);
          terrainRelief = patch.relief;
          terrainMaterial = new T.MeshStandardMaterial({ color: '#e2dfd4', roughness: 1, vertexColors: true, map: (planets.get('Earth')!.material as T.MeshStandardMaterial).map });
          const measuredMesh = new T.Mesh(patch.geometry, terrainMaterial);
          terrain=new T.Group(); terrain.add(measuredMesh);
          picker = buildLandingPicker(p.profile); terrain.add(picker.group); plant.current();
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
      if(terrain)terrain.visible=p.stage==='earth';
      departingPatches.forEach(patch => { patch.visible = p.stage==='earth'; });
      sun.position.set(-5,5,8);sun.target.position.set(0,0,0);
      if (previous === null && p.stage !== 'title') {
        reveal = 1;
        if (p.stage === 'earth') {
          const above = globePoint(p.selectedAnalog.lat, p.selectedAnalog.lon, radii.Earth);
          controls.target.copy(above).add(centres.Earth); camera.position.copy(above).multiplyScalar(1 + 2.2 / radii.Earth).add(centres.Earth);
        } else { controls.target.set(0, 0, 0); camera.position.set(0, 2, 14); }
        camera.lookAt(controls.target);
      }
      const worldsView = () => ({ target: p.hover ? centres[p.hover].clone().multiplyScalar(.35) : new T.Vector3(), offset: new T.Vector3(0, 2, p.hover ? 11 : 14).multiplyScalar(Math.max(1, 1.1 / camera.aspect)) });
      if(surface && terrain) {
        // Down to the measured ground. From above the site this is one unbroken swing; from
        // beyond its horizon the camera first crosses over Earth to a point above it.
        const site = terrain.position.clone(), normal = UP.clone().applyQuaternion(terrain.quaternion);
        const offset = new T.Vector3(2000,1300 + terrainRelief*.5,3200).applyQuaternion(terrain.quaternion).multiplyScalar(METRE_SCALE);
        const view: CameraPose = { position: site.clone().add(offset), target: site, up: normal };
        lastSite = site;
        if (elevationOver(camera.position, site) >= .2) swoopTo(view, site);
        else orbitTo({ position: site.clone().addScaledVector(normal, 2.2), target: site, up: UP.clone() }, () => swoopTo(view, site));
      } else if(p.stage==='earth' && p.surface) {
        // The site's terrain is still loading. Wait directly above it, so the descent that
        // follows carries straight on down instead of starting again from a side-on orbit.
        const site = globePoint(p.selectedAnalog.lat,p.selectedAnalog.lon,radii.Earth).add(centres.Earth);
        orbitTo({ position: site.clone().add(globePoint(p.selectedAnalog.lat,p.selectedAnalog.lon,2.2)), target: site, up: UP.clone() });
      } else if(p.stage==='title') {
        fly(TITLE_AIM.clone(), TITLE_POSITION.clone().sub(TITLE_AIM));
        // First frame: start on the title's flight, not on a move towards it.
        if (previous === null) { camera.position.copy(TITLE_POSITION); camera.lookAt(goalTarget); }
      } else if(p.stage==='worlds') {
        const { target, offset } = worldsView();
        if (route?.kind === 'arrival') { route.to = { position: target.clone().add(offset), target, up: UP.clone() }; aim(target, offset, UP.clone()); }
        else if (previous === 'title' && !reduced.matches) {
          // The flight in from the title: a long curving approach that ends on the three worlds.
          aim(target, offset, UP.clone());
          route = { kind: 'arrival', from: pose(), to: { position: target.clone().add(offset), target, up: UP.clone() }, elapsed: 0, seconds: LAUNCH_SECONDS + ARRIVAL_SECONDS };
        } else fly(target, offset);
      } else {
        const selected=p.stage==='earth'?p.selectedAnalog:p.targets.find(t=>t.id===p.targetId);
        const offset=selected?globePoint(selected.lat*.8,selected.lon,p.stage==='earth'?5.5:3.8):new T.Vector3(0,1,4.5);
        offset.multiplyScalar(Math.max(1,.85/camera.aspect));
        const centre = centres[body].clone();
        if (p.stage !== 'earth') fly(centre, offset);
        else {
          const view: CameraPose = { position: centre.clone().add(offset), target: centre, up: UP.clone() };
          // Leaving the ground: rise back out along the same kind of swing that came down.
          const low = camera.position.distanceTo(centres.Earth) - radii.Earth < .05;
          if (low && lastSite && elevationOver(view.position, lastSite) >= .2) swoopTo(view, lastSite); else orbitTo(view);
        }
      }
      limits();
    }; update.current();
    const ray=new T.Raycaster(); let down={x:0,y:0};
    const cast=(e:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);};
    const hit=(e:PointerEvent) => {cast(e);return ray.intersectObjects([...planets.values(),...markers.children],true)[0]?.object;};
    /** The measured ground under the pointer, in the patch's frame, when it is inside the selectable area. */
    const ground=(e:PointerEvent) => {
      if (!surface || moving || !terrain || !picker) return null;
      cast(e); terrain.updateMatrixWorld();
      const origin = terrain.worldToLocal(ray.ray.origin.clone()), ahead = terrain.worldToLocal(ray.ray.origin.clone().add(ray.ray.direction));
      const point = picker.pick(origin, ahead.sub(origin).normalize());
      return point && picker.inArea(point) ? point : null;
    };
    const overSite=(id:string|null)=>{if(id===hoverSite)return;hoverSite=id;live.current.onHoverSite(id);paint.current();};
    const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{
      if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;
      // A click during the launch skips ahead to the burst of light that reveals the worlds.
      if(route?.kind==='arrival'){route.elapsed=Math.max(route.elapsed,LAUNCH_SECONDS+.33*ARRIVAL_SECONDS);return;}
      const p=live.current;
      if(surface){const point=ground(e);if(point)p.onLanding({x:Math.round(point.x),y:Math.round(-point.z)});return;}
      const obj=hit(e);
      if(p.stage==='worlds' && ['Moon','Mars'].includes(obj?.userData.body))p.onBody(obj!.userData.body);
      else if(obj?.userData.id){if(p.stage==='earth')p.onAnalog(obj.userData.id);else p.onTarget(obj.userData.id);}
    };
    const pointerMove=(e:PointerEvent)=>{
      if(route?.kind==='arrival')return;
      if(surface){const point=ground(e);picker?.setHover(point);renderer.domElement.style.cursor=point?'crosshair':'grab';return;}
      const obj=hit(e),p=live.current,world=p.stage==='worlds'&&['Moon','Mars'].includes(obj?.userData.body)?obj!.userData.body as Body:null;
      overSite(obj?.userData.id??null);
      renderer.domElement.style.cursor=obj?.userData.id||world?'pointer':p.stage==='worlds'||p.stage==='title'?'default':'grab';
      if(world&&p.hover!==world)p.onHover(world);
    };
    const pointerLeave=()=>{overSite(null);picker?.setHover(null);};
    renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerleave',pointerLeave);
    const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(!surface)update.current();}});resize.observe(host);
    let frame=0,last=performance.now();
    const render=()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
      let arrival: number | null = null, launch = 0;
      if (route) {
        route.elapsed += dt;
        const progress = reduced.matches ? 1 : Math.min(route.elapsed / route.seconds, 1);
        let at: CameraPose;
        if (route.kind === 'arrival') {
          // Fast out of the title, then a long slow settle onto the worlds, curving in from the side.
          // The launch plays first, from the title's fixed camera; then the camera flies in.
          launch = Math.min(route.elapsed, LAUNCH_SECONDS); arrival = reduced.matches ? 1 : T.MathUtils.clamp((route.elapsed - LAUNCH_SECONDS) / ARRIVAL_SECONDS, 0, 1);
          if (arrival >= .77 && !arrived) { arrived = true; live.current.onArrived?.(); }
          // Ease away from the launch's fixed view and settle slowly: no jolt at either end.
          const e = 1 - Math.pow(1 - T.MathUtils.smoothstep(arrival, 0, 1), 1.9), bend = new T.Vector3(17, 7, 40), a = route.from.position, b = route.to.position;
          // The camera banks gently into the curve and levels out as it settles.
          const position = a.clone().multiplyScalar((1 - e) ** 2).addScaledVector(bend, 2 * e * (1 - e)).addScaledVector(b, e * e), target = route.from.target.clone().lerp(route.to.target, e);
          const roll = -.14 * Math.sin(Math.PI * e) * (1 - e);
          at = { position, target, up: UP.clone().applyAxisAngle(target.clone().sub(position).normalize(), roll) };
        } else at = route.kind === 'orbit' ? earthFlight(route.from, route.to, progress) : siteSwoop(route.from, route.to, route.pivot, progress);
        camera.position.copy(at.position); camera.up.copy(at.up); controls.target.copy(at.target); camera.lookAt(at.target);
        if (progress === 1) { const next = route.kind === 'arrival' ? undefined : route.next; if (next) next(); else finishFlight(); }
      } else if(moving){const a=reduced.matches?1:1-Math.exp(-4*dt);controls.target.lerp(goalTarget,a);camera.up.lerp(goalUp,a).normalize();const off=camera.position.clone().sub(controls.target);const distance=Math.exp(T.MathUtils.lerp(Math.log(Math.max(off.length(),.000001)),Math.log(goalOffset.length()),a));off.normalize().lerp(goalOffset.clone().normalize(),a).normalize().multiplyScalar(distance);camera.position.copy(controls.target).add(off);camera.lookAt(controls.target);if(camera.position.distanceTo(goalTarget.clone().add(goalOffset))<goalOffset.length()*.002){camera.position.copy(goalTarget).add(goalOffset);controls.target.copy(goalTarget);finishFlight();}}
      const current = live.current;
      // The worlds come out of the arrival's burst of light; on the title they are a single bright point.
      if (arrival !== null) reveal = T.MathUtils.smoothstep(arrival, .3, .5);
      else reveal += ((current.stage === 'title' ? 0 : 1) - reveal) * (1 - Math.exp(-3 * dt));
      flash.style.opacity = arrival === null ? '0' : String(.4 * Math.exp(-(((arrival - .36) / .13) ** 2)));
      title.update(dt, current.stage, arrival, 1 - reveal, reduced.matches, launch);
      // The view widens a touch as the worlds come up, then eases back.
      const fov = 42 + (arrival === null ? 0 : 6 * Math.exp(-(((arrival - .3) / .2) ** 2)));
      if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      if (arrival === null) arrived = false;
      if (!reduced.matches) starShell.rotation.y += dt * .004;
      // Earth and its horizon stay present at every altitude; no globe/terrain swap.
      const nearGround = terrain && current.stage === 'earth' ? 1 - T.MathUtils.smoothstep(camera.position.distanceTo(centres.Earth) - radii.Earth, .002, .025) : 0;
      for(const [body,mesh] of planets) {
        // On the arrival each world swells into view in turn, turning a little as it settles.
        const own = arrival === null ? reveal : easeOutBack(T.MathUtils.clamp((arrival - REVEAL_AT[body]) / .2, 0, 1));
        mesh.visible = own > .002 && (!surface || body === 'Earth');
        mesh.rotation.y = arrival === null ? 0 : (1 - T.MathUtils.clamp((arrival - REVEAL_AT[body]) / .45, 0, 1)) ** 2 * -.9;
        // A hovered world brightens and swells a little.
        const lit = body === 'Earth' ? 0 : (glow[body] += ((current.stage === 'worlds' && current.hover === body ? 1 : 0) - glow[body]) * (1 - Math.exp(-9 * dt)));
        (mesh.material as T.MeshStandardMaterial).emissiveIntensity = lit * .3;
        mesh.scale.setScalar(Math.max(own, .001) * (1 + lit * .05));
        const air = atmospheres.get(body);
        if (air) air.visible = !surface && nearGround === 0;
      }
      // Thin enough that the place the camera is looking at stays in view all the way down.
      haze.density = nearGround * Math.min(160, .45 / Math.max(camera.position.distanceTo(controls.target), 1e-6));
      scene.background = nearGround > 0 ? sky.set(0x030405).lerp(haze.color, nearGround) : null;
      // The title's pad is lit by its own floodlights: the scene's sun and fill come up as the shuttle climbs.
      ambient.intensity = T.MathUtils.lerp(1.3, .65, nearGround) * (1 - .82 * title.dim); sun.intensity = 3 * (1 - .9 * title.dim);
      if (terrain) {
        const localSun = new T.Vector3(-4000,5000,1500).applyQuaternion(terrain.quaternion).multiplyScalar(METRE_SCALE).add(terrain.position);
        sun.position.set(-5,5,8).lerp(localSun, nearGround); sun.target.position.set(0,0,0).lerp(terrain.position, nearGround);
        terrain.updateMatrixWorld(); picker?.tick(terrain.worldToLocal(camera.position.clone()), surface && !moving, dt);
      }
      if(!moving)controls.update();
      const streamed = surface && scenery?.draw(camera);
      if (streamed) { planets.get('Earth')!.visible = false; scene.background = null; renderer.autoClear = false; }
      renderer.render(scene,camera); renderer.autoClear = true;frame=requestAnimationFrame(render);};render();
    return()=>{disposed=true;scenery?.dispose();cancelAnimationFrame(frame);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerleave',pointerLeave);textures.forEach(t=>t.dispose());release(scene);renderer.dispose();renderer.domElement.remove();flash.remove();update.current=()=>{};paint.current=()=>{};plant.current=()=>{};};
  },[]);
  useEffect(()=>update.current(),[props.stage,props.body,props.hover,props.targetId,props.analogId,props.profile,props.surface,props.analogs,props.targets]);
  useEffect(()=>paint.current(),[props.hoverSite]);
  useEffect(()=>plant.current(),[props.landing]);
  return <div className="opening-world-scene" ref={mount}>{error&&<p className="scene-unavailable">3D graphics are unavailable. Use the destination and site controls to continue.</p>}</div>;
}
