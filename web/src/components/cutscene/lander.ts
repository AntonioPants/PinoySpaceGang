import * as THREE from 'three';
import { isLargeVehicle } from '../../game/equipment';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GEAR_PRESETS } from '../../../../app/sim/src/gear';
import type { HazardSensorId } from '../../../../app/sim/src/types';
import { liveries, type LanderAppearance } from '../../lib/landerAppearance';

/** Shared by the hangar, cinematics and live descent. Old missions use the default appearance. */
export interface LanderSpec extends LanderAppearance { vehicleId?: string; landingGearId?: string; hazardSensor?: HazardSensorId }
/** The legs drawn for each gear: the stance, leg count and pads the physics flies (app/sim/src/gear.ts). */
export const GEAR: Record<string, { legs: number; radius: number; pad: number }> = Object.fromEntries(
  Object.values(GEAR_PRESETS).map(g => [g.gearId, { legs: g.legs, radius: g.radiusM, pad: g.padRadiusM }]));
export interface Lander {
  group: THREE.Group; // origin = foot level, +Y up
  flame: THREE.Mesh;
  mast: THREE.Group;
  beaconTip: THREE.Mesh;
  beaconMat: THREE.MeshBasicMaterial;
  nozzleY: number;
  debrisColors: number[];
  footRadius: number;
  /** 0 = legs folded up against the body (inside the rocket fairing), 1 = deployed for landing. */
  setGear(deployed: number): void;
  /** 0 = solar arrays folded up against the body, 1 = deployed. */
  setArrays(deployed: number): void;
}

/**
 * Bakes every mesh under `root` into one mesh with per-vertex colours from each part's material,
 * so a moving assembly (a leg, an array, a rocket stage) costs one draw call.
 */
export function bakeColoured(root: THREE.Object3D, material: THREE.Material) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), parts: THREE.BufferGeometry[] = [], relative = new THREE.Matrix4();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = object.geometry as THREE.BufferGeometry;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(relative.multiplyMatrices(inverse, object.matrixWorld));
    const colour = (object.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(0xffffff);
    const colours = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colours.length; i += 3) { colours[i] = colour.r; colours[i + 1] = colour.g; colours[i + 2] = colour.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    parts.push(geometry); source.dispose();
  });
  root.clear();
  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('Assembly could not be baked.');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

/** Bake static detail into one draw call per material, keeping animated parts separate. */
function batchStatic(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = object.geometry as THREE.BufferGeometry;
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const material = object.material as THREE.Material;
    const parts = batches.get(material) ?? [];
    parts.push(geometry); batches.set(material, parts);
    source.dispose();
  });
  root.clear();
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (!geometry) throw new Error('Lander detail could not be assembled.');
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
  }
}

/**
 * Engineered, illustrative lander. Each vehicle has its own body: the two prototypes, and real
 * landers drawn after the craft that flew (simplified, not to engineering drawings). Every body
 * takes the same customisation: livery colours, landing gear, solar arrays, antenna and hazard
 * sensor. Attachments are cosmetic; gear retains its physical footprint.
 */
export function buildLander(spec: LanderSpec = {}): Lander {
  const g = new THREE.Group(), structure = new THREE.Group(); g.add(structure);
  const payload = isLargeVehicle(spec.vehicleId);
  const gear = GEAR[spec.landingGearId ?? ''] ?? GEAR['standard-four'];
  const colours = liveries.find(livery => livery.id === spec.liveryId) ?? liveries[0];
  const mat = (color: number, metalness: number, roughness: number) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const hull = mat(colours.hull, .5, .46), shell = mat(colours.shell, .25, .48);
  const dark = mat(0x252b32, .55, .52), metal = mat(0x969da3, .75, .3);
  const accent = mat(colours.accent, .35, .4), glass = mat(0x102d40, .65, .17);
  const cell = mat(0x183e71, .55, .3);
  const materials = [hull, shell, dark, metal, accent, glass, cell];
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x=0, y=0, z=0, parent: THREE.Object3D=structure) => {
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(x,y,z); parent.add(mesh); return mesh;
  };
  const box = (w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=structure) => add(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
  const cylinder = (top:number,bottom:number,height:number,m:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=structure,segments=24) => add(new THREE.CylinderGeometry(top,bottom,height,segments),m,x,y,z,parent);
  const strut = (a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Object3D=structure) => {
    const dir=b.clone().sub(a), mesh=cylinder(r,r,dir.length(),m,0,0,0,parent,8);
    mesh.position.copy(a).addScaledVector(dir,.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()); return mesh;
  };
  const ring = (radius:number,tube:number,m:THREE.Material,y:number) => {
    const mesh=add(new THREE.TorusGeometry(radius,tube,8,40),m,0,y,0); mesh.rotation.x=Math.PI/2; return mesh;
  };
  /** Where a body takes its legs, arrays, antenna, sensor and beacon mast, and where its engine fires. */
  interface Frame { radius:number; hipY:number; braceY:number; wingX:number; wingY:number; roof:number; antenna:[number,number]; mast:[number,number]; sensor:{face:number;r:number;y:number}; nozzleY:number; flameR:number }
  const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const bellMat=dark.clone(); bellMat.side=THREE.DoubleSide; materials.push(bellMat);
  const prism=(r:number,h:number,sides:number,m:THREE.Material,x:number,y:number,z:number,turn=0)=>{const mesh=cylinder(r,r,h,m,x,y,z,structure,sides);mesh.rotation.y=turn;return mesh;};
  const sphere=(r:number,m:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=structure)=>add(new THREE.SphereGeometry(r,16,10),m,x,y,z,parent);
  /** An engine bell whose exit is at (x, y, z), opening downwards, or canted outwards towards `dir`. */
  const bell=(x:number,z:number,exit:number,y:number,len:number,tilt=0,dir=0)=>{
    const holder=new THREE.Group(); holder.position.set(x,y,z); structure.add(holder);
    if(tilt)holder.quaternion.setFromUnitVectors(V(0,-1,0),V(Math.cos(dir)*Math.sin(tilt),-Math.cos(tilt),Math.sin(dir)*Math.sin(tilt)));
    add(new THREE.LatheGeometry([[1,0],[.9,.12],[.7,.35],[.48,.75],[.42,1]].map(([r,v])=>new THREE.Vector2(r*exit,v*len)),24),bellMat,0,0,0,holder);
    const rim=add(new THREE.TorusGeometry(exit,Math.max(.012,exit*.06),6,24),metal,0,0,0,holder); rim.rotation.x=Math.PI/2;
  };
  /** A flat panel of photovoltaic cells facing outwards along its own +z. */
  const cellPanel=(w:number,h:number,x:number,y:number,z:number,turn:number,cols=4,rows=4)=>{
    const panel=new THREE.Group(); panel.position.set(x,y,z); panel.rotation.y=turn; structure.add(panel);
    box(w,h,.05,dark,0,0,0,panel);
    for(let c=0;c<cols;c++)for(let r=0;r<rows;r++)box(w/cols-.03,h/rows-.03,.015,cell,-w/2+(c+.5)*w/cols,-h/2+(r+.5)*h/rows,.03,panel);
  };
  /** Crinkled foil: a few slightly skewed patches over a face, so a blanket reads as a blanket. */
  const foil=(w:number,h:number,x:number,y:number,z:number,turn:number,seed:number)=>{
    const face=new THREE.Group(); face.position.set(x,y,z); face.rotation.y=turn; structure.add(face);
    for(let i=0;i<6;i++){const k=Math.sin(seed*12.9+i*78.2)*.5+.5,patch=box(w*(.25+.2*k),h*(.3+.25*k),.025,i%3?hull:accent,(k-.5)*w*.6,((i*.37+k)%1-.5)*h*.6,.02,face);patch.rotation.z=(k-.5)*.5;}
  };
  /** Four-nozzle attitude-control quad, its body pointing along `a` from the centre. */
  const rcs=(x:number,y:number,z:number,a:number)=>{
    const pod=new THREE.Group(); pod.rotation.y=a; pod.position.set(x,y,z); structure.add(pod);
    box(.3,.26,.26,dark,0,0,0,pod);
    for(const x of [-1,1]){const n=cylinder(.06,.1,.16,metal,x*.2,0,0,pod,10);n.rotation.z=x*Math.PI/2;}
    for(const y of [-1,1]){const n=cylinder(.06,.1,.16,metal,0,y*.19,0,pod,10);if(y<0)n.rotation.z=Math.PI;}
  };
  const wheel=(x:number,y:number,z:number,r:number,w:number,parent:THREE.Object3D=structure)=>{const mesh=cylinder(r,r,w,dark,x,y,z,parent,14);mesh.rotation.x=Math.PI/2;return mesh;};
  const hips=(r:number,y:number)=>Array.from({length:gear.legs},(_,k)=>{const a=Math.PI/gear.legs+k*2*Math.PI/gear.legs;return V(Math.cos(a)*r,y,Math.sin(a)*r);});

  const prototype=():Frame=>{
    const bodyY=payload?2.35:2.2, bodyH=payload?1.75:1.4;
    const radius=payload?1.88:1.63, upperY=payload?3.65:3.35, roof=upperY+.45;
    // Pressure vessel, exposed frame rings, eight separately fitted thermal panels.
    cylinder(radius*.96,radius,bodyH,dark,0,bodyY,0,structure,8);
    cylinder(radius*.96,radius*.96,.13,metal,0,bodyY+bodyH/2,0,structure,8);
    cylinder(radius,radius,.14,dark,0,bodyY-bodyH/2,0,structure,8);
    for(let i=0;i<8;i++) {
      const a=(i+.5)*Math.PI/4, panel=new THREE.Group(); panel.rotation.y=a;
      panel.position.set(Math.sin(a)*radius*.923,bodyY,Math.cos(a)*radius*.923); structure.add(panel);
      box(radius*.7,bodyH-.16,.1,hull,0,0,0,panel);
      box(radius*.56,.055,.025,accent,0,bodyH*.27,.065,panel);
      // Panel fasteners and a recessed service cover give scale without textures.
      for(const x of [-1,1])for(const y of [-1,1])add(new THREE.SphereGeometry(.035,6,4),metal,x*radius*.29,y*(bodyH/2-.18),.065,panel);
      box(.3,.24,.035,dark,0,-.15,.065,panel);
      for(let j=0;j<3;j++)box(.22,.018,.015,metal,0,-.22+j*.065,.089,panel);
    }
    cylinder(payload?1.2:1,payload?1.55:1.3,.9,shell,0,upperY,0,structure,8);
    cylinder(payload?1.23:1.03,payload?1.23:1.03,.09,dark,0,roof,0,structure,8);
    cylinder(.7,.7,.08,metal,0,roof+.07,0);
    cylinder(.56,.56,.09,shell,0,roof+.12,0);
    // Front inspection windows, recessed in dark bezels.
    for(const x of [-1,1]) {
      const window=new THREE.Group(); window.position.set(x*.42,upperY+.08,payload?1.24:1.05); window.rotation.x=-.28; structure.add(window);
      box(.58,.34,.12,dark,0,0,0,window); box(.46,.23,.025,glass,0,0,.072,window);
      box(.44,.025,.014,metal,0,.08,.09,window);
    }
    // Four attitude-control pods with paired directional nozzles.
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+Math.PI/4, pod=new THREE.Group(); pod.rotation.y=a;
      pod.position.set(Math.sin(a)*(radius+.08),bodyY+.42,Math.cos(a)*(radius+.08)); structure.add(pod);
      box(.34,.28,.3,dark,0,0,0,pod);
      for(const x of [-1,1]){const nozzle=cylinder(.075,.12,.18,metal,x*.22,0,0,pod,12);nozzle.rotation.z=x*Math.PI/2;}
    }
    // Bell with a curved profile and cooling rings, rather than a plain cone.
    const bellPoints=[[.68,.68],[.61,.78],[.47,1.0],[.3,1.3],[.27,1.53]].map(([r,y])=>new THREE.Vector2(r*(payload?1.2:1),y));
    add(new THREE.LatheGeometry(bellPoints,32),bellMat);
    ring(payload?.82:.69,.045,metal,.69);
    for(let i=0;i<4;i++)ring(.29+i*.028,.025,metal,1.38-i*.075);
    for(const x of [-1,1])strut(new THREE.Vector3(x*.43,1.45,0),new THREE.Vector3(x*.8,1.9,0),.065,metal);
    if(payload)for(const z of [-1,1]) {
      const tank=add(new THREE.CapsuleGeometry(.48,.6,6,16),shell,0,2.5,z*2.05);
      cylinder(.5,.5,.12,accent,0,2.5,z*2.05);
      for(const y of [2.15,2.85])strut(new THREE.Vector3(0,y,z*1.5),new THREE.Vector3(0,y,tank.position.z),.08,dark);
    }
    // The payload body's tanks sit fore and aft (±z), so its sensor faces +x, clear of them.
    return {radius,hipY:bodyY+.35,braceY:bodyY-.6,wingX:radius+.35,wingY:upperY-.35,roof,antenna:[.42,.2],mast:[0,0],
      sensor:{face:payload?Math.PI/2:0,r:radius+.17,y:bodyY-.15},nozzleY:.7,flameR:payload?.75:.6};
  };

  const bodies:Record<string,()=>Frame>={
    // Apollo LM: a foil-wrapped octagonal descent stage under the angular, faceted crew cabin.
    'apollo-lm':()=>{
      prism(2,1.55,8,hull,0,1.75,0,Math.PI/8);
      prism(2.03,.08,8,dark,0,2.55,0,Math.PI/8); prism(2.03,.08,8,dark,0,.98,0,Math.PI/8);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;foil(1.4,1.3,Math.sin(a)*1.86,1.75,Math.cos(a)*1.86,a,i+1);}
      bell(0,0,.78,.62,.9);
      // ascent stage: cabin, faceted front with two triangular windows and the hatch, aft equipment bay
      box(2.3,1.5,1.7,shell,0,3.35,-.1);
      const front=new THREE.Group(); front.position.set(0,3.45,.95); structure.add(front);
      box(1.7,1.3,.5,shell,0,0,0,front);
      for(const x of [-1,1]){const w=box(.5,.36,.03,glass,x*.45,.3,.27,front);w.rotation.set(-.3,x*.35,x*.45);box(.6,.05,.05,dark,x*.45,.5,.28,front);}
      box(.8,.8,.04,dark,0,-.25,.27,front);
      box(1.1,.05,.75,metal,0,2.6,1.7);
      box(1.8,1.05,.8,dark,0,3.3,-1.35);
      for(const x of [-1,1])sphere(.5,hull,x*1.2,3.25,.05);
      cylinder(.48,.52,.45,shell,0,4.32,-.1); ring(.5,.04,metal,4.55);
      for(const [x,z] of [[1.3,1],[-1.3,1],[1.3,-1.2],[-1.3,-1.2]])rcs(x,3.95,z,Math.atan2(x,z));
      return {radius:2,hipY:2.2,braceY:1.15,wingX:2.35,wingY:2.1,roof:4.57,antenna:[.75,-.75],mast:[-.75,-.8],sensor:{face:Math.PI/2,r:2.15,y:1.55},nozzleY:.62,flameR:.8};
    },
    // Surveyor: an open tubular spaceframe around a tall central mast, with three small vernier engines.
    surveyor:()=>{
      const feet=hips(1.45,1.15), top=V(0,2.9,0), hub=V(0,1.15,0);
      feet.forEach((h,i)=>{strut(h,feet[(i+1)%feet.length],.055,metal);strut(h,top,.04,metal);strut(h,hub,.045,dark);});
      cylinder(.07,.07,3.05,metal,0,2.7,0); ring(.5,.05,dark,1.15);
      for(let i=0;i<3;i++){const a=i*2*Math.PI/3;bell(Math.cos(a)*.75,Math.sin(a)*.75,.13,.72,.32);sphere(.2,metal,Math.cos(a+1)*.65,1.4,Math.sin(a+1)*.65);}
      box(.75,.55,.5,shell,.75,1.6,-.45); box(.65,.5,.5,shell,-.75,1.55,-.4);
      for(const [x,z] of [[.75,-.2],[-.75,-.15]])for(let j=0;j<3;j++)box(.5,.02,.01,metal,x,1.45+j*.1,z+.01);
      const camera=cylinder(.14,.14,.55,glass,-.55,1.75,.65); camera.rotation.x=.25; box(.3,.25,.3,dark,-.55,2.08,.72);
      strut(V(.5,1.2,.75),V(1.15,.85,1.25),.03,metal); box(.15,.12,.2,dark,1.15,.8,1.25);
      return {radius:1.45,hipY:1.15,braceY:.72,wingX:.55,wingY:3.6,roof:4.2,antenna:[0,0],mast:[0,0],sensor:{face:Math.PI*.15,r:1.05,y:1.6},nozzleY:.72,flameR:.35};
    },
    // Chang'e 3/4: a gold box lander carrying the Yutu rover on its deck, one large variable-thrust engine.
    'change-3':()=>{
      box(2.4,1.4,2.4,hull,0,1.9,0); box(2.55,.1,2.55,shell,0,2.65,0); box(2.5,.08,2.5,dark,0,1.17,0);
      for(let i=0;i<4;i++){const a=i*Math.PI/2;foil(2,1.2,Math.sin(a)*1.2,1.9,Math.cos(a)*1.2,a,i+3);}
      cylinder(.5,1,.45,dark,0,.98,0); bell(0,0,.62,.42,.62);
      const rover=new THREE.Group(); rover.position.set(.35,2.7,.3); structure.add(rover);
      box(.9,.38,.7,shell,0,.4,0,rover); box(.92,.05,.72,accent,0,.62,0,rover);
      for(const x of [-.35,0,.35])for(const z of [-1,1])wheel(x,.15,z*.42,.13,.1,rover);
      for(const x of [-1,1]){const w=box(.5,.02,.62,cell,x*.72,.64,0,rover);w.rotation.z=-x*.3;}
      cylinder(.03,.03,.5,metal,.3,.88,.2,rover); box(.24,.12,.12,dark,.3,1.15,.2,rover);
      box(.3,.3,.3,dark,-.85,2.85,-.85);
      return {radius:1.65,hipY:2.2,braceY:1.3,wingX:1.55,wingY:2.3,roof:2.7,antenna:[-.75,.8],mast:[-.85,-.3],sensor:{face:0,r:1.37,y:1.6},nozzleY:.42,flameR:.65};
    },
    // Chandrayaan-3 Vikram: a gold cuboid with a fixed side panel, four throttleable engines and Pragyan's ramp.
    vikram:()=>{
      box(2.1,1.35,2.1,hull,0,1.8,0); box(2.2,.08,2.2,shell,0,2.5,0); box(2.15,.08,2.15,dark,0,1.12,0);
      for(const a of [0,Math.PI/2,-Math.PI/2])foil(1.7,1.1,Math.sin(a)*1.05,1.8,Math.cos(a)*1.05,a,a+7);
      cellPanel(1.8,1.1,0,1.8,-1.09,Math.PI,5,3);
      for(const x of [-1,1])for(const z of [-1,1])bell(x*.5,z*.5,.22,.62,.45);
      const ramp=box(.75,.04,2.52,dark,0,1.37,1.74); ramp.rotation.x=Math.atan2(2.15,1.32);
      for(const x of [-.38,.38])strut(V(x,2.45,1.08),V(x,.3,2.4),.03,metal);
      box(.55,.28,.45,shell,0,2.68,.5); box(.5,.02,.4,cell,0,2.83,.5);
      strut(V(-1.05,2.35,.2),V(-1.75,2.85,.2),.022,metal); strut(V(1.05,2.35,-.2),V(1.75,2.85,-.2),.022,metal);
      return {radius:1.45,hipY:2,braceY:1.2,wingX:1.4,wingY:2.25,roof:2.55,antenna:[-.5,-.5],mast:[.6,-.6],sensor:{face:Math.PI/2,r:1.22,y:1.55},nozzleY:.62,flameR:.7};
    },
    // SLIM: a small upright box with body-mounted cells, two capsule tanks and twin main engines.
    slim:()=>{
      box(1.4,1.9,1.4,shell,0,2.1,0); box(1.45,.07,1.45,dark,0,3.08,0); box(.8,.25,.8,dark,0,1.02,0);
      for(const z of [-1,1])cellPanel(1.25,1.6,0,2.15,z*.72,z>0?0:Math.PI,3,5);
      for(const x of [-1,1]){add(new THREE.CapsuleGeometry(.42,1.3,6,16),hull,x*.95,2.05,0);cylinder(.44,.44,.08,accent,x*.95,2.05,0);}
      for(const x of [-1,1])bell(x*.32,0,.25,.75,.38);
      return {radius:1.2,hipY:1.6,braceY:1,wingX:1.75,wingY:2.7,roof:3.12,antenna:[.35,.35],mast:[-.35,-.35],sensor:{face:Math.PI/4,r:1.05,y:1.4},nozzleY:.75,flameR:.45};
    },
    // Nova-C: a tall hexagonal prism with solar cells on its faces and one methane-oxygen engine.
    'nova-c':()=>{
      prism(1.55,2.9,6,shell,0,2.55,0); prism(1.58,.65,6,hull,0,1.45,0); prism(1.6,.08,6,dark,0,4.02,0);
      for(let i=0;i<6;i++){const a=(i+.5)*Math.PI/3;if(i===0)box(1,1.4,.05,dark,Math.sin(a)*1.36,2.9,Math.cos(a)*1.36).rotation.y=a;else cellPanel(1.3,1.8,Math.sin(a)*1.36,3,Math.cos(a)*1.36,a,3,4);}
      for(const x of [-1,1])add(new THREE.SphereGeometry(.5,16,8,0,Math.PI*2,0,Math.PI/2),metal,x*.5,4.05,0);
      cylinder(.35,.6,.4,dark,0,.92,0); bell(0,0,.55,.35,.6);
      return {radius:1.45,hipY:1.55,braceY:1.15,wingX:1.75,wingY:3.3,roof:4.06,antenna:[-.75,.75],mast:[.75,-.75],sensor:{face:Math.PI/6+Math.PI/3,r:1.62,y:1.5},nozzleY:.35,flameR:.6};
    },
    // Beresheet: a low round body under a deck of cells, its tanks visible beneath.
    beresheet:()=>{
      prism(1.15,.75,12,hull,0,1.65,0); prism(1.2,.07,12,dark,0,2.05,0);
      cylinder(1.1,1.1,.04,cell,0,2.1,0,structure,12);
      for(let i=0;i<3;i++){const bar=box(2.2,.05,.06,metal,0,2.13,0);bar.rotation.y=i*Math.PI/3;}
      for(const x of [-1,1])sphere(.45,metal,x*.45,1.2,0);
      bell(0,0,.25,.75,.4); box(.3,.2,.04,accent,0,1.7,1.16);
      return {radius:1.1,hipY:1.55,braceY:1.05,wingX:1.4,wingY:1.75,roof:2.12,antenna:[.5,.5],mast:[-.5,-.5],sensor:{face:0,r:1.3,y:1.5},nozzleY:.75,flameR:.4};
    },
    // Viking: a flat hexagonal body with finned RTG covers, camera towers, a weather boom and three
    // terminal engines whose heads are clusters of small nozzles.
    viking:()=>{
      prism(1.45,.55,6,hull,0,1.6,0,Math.PI/6); prism(1.5,.06,6,dark,0,1.9,0,Math.PI/6);
      for(const x of [-1,1]){box(.5,.42,.8,dark,x*.75,2.15,-.35);for(let j=0;j<5;j++)box(.62,.46,.025,metal,x*.75,2.15,-.7+j*.17);}
      for(const x of [-.35,.35]){cylinder(.11,.13,.75,shell,x,2.3,.85,structure,12);cylinder(.15,.15,.22,dark,x,2.75,.85,structure,12);}
      strut(V(.9,1.9,.3),V(1.2,3,.6),.03,metal); box(.25,.12,.12,shell,1.2,3.05,.6);
      box(.4,.3,.8,shell,-.95,2.05,.45);
      for(let i=0;i<3;i++){const a=i*2*Math.PI/3,x=Math.sin(a)*.95,z=Math.cos(a)*.95;box(.4,.3,.4,dark,x,1.2,z);for(let n=0;n<6;n++)cylinder(.035,.05,.12,metal,x+(n%3-1)*.12,.99,z+(Math.floor(n/3)-.5)*.14,structure,8);}
      return {radius:1.45,hipY:1.65,braceY:1.15,wingX:1.75,wingY:1.75,roof:1.93,antenna:[.2,-1],mast:[-.25,-1.05],sensor:{face:Math.PI,r:1.42,y:1.55},nozzleY:.93,flameR:.55};
    },
    // Phoenix / InSight: a ten-sided deck over an equipment box, twelve pulsed thrusters, a robotic arm.
    phoenix:()=>{
      prism(1.25,.32,10,shell,0,1.6,0); prism(1.28,.05,10,dark,0,1.78,0); box(1.3,.5,1,hull,0,1.2,0);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;cylinder(.04,.07,.16,metal,Math.sin(a)*.95,1.36,Math.cos(a)*.95,structure,8);}
      const shoulder=V(-.9,1.85,.6), elbow=V(-1.5,2.4,1), wrist=V(-1.9,1.6,1.3);
      strut(shoulder,elbow,.05,metal); strut(elbow,wrist,.045,metal); sphere(.08,accent,elbow.x,elbow.y,elbow.z); box(.2,.14,.2,dark,wrist.x,wrist.y-.08,wrist.z);
      add(new THREE.SphereGeometry(.32,16,8,0,Math.PI*2,0,Math.PI/2),hull,.4,1.82,-.4);
      strut(V(.6,1.8,.5),V(.6,2.9,.5),.025,metal); box(.18,.1,.18,dark,.6,2.95,.5);
      return {radius:1.25,hipY:1.55,braceY:1.05,wingX:1.55,wingY:1.62,roof:1.84,antenna:[-.4,-.55],mast:[0,.75],sensor:{face:Math.PI,r:1.35,y:1.3},nozzleY:1.28,flameR:.5};
    },
    // MSL Sky Crane: a descent stage with four tanks and eight canted engines, the rover held beneath.
    'sky-crane':()=>{
      prism(1.55,.35,8,hull,0,3.5,0,Math.PI/8); prism(1,.55,8,dark,0,3.55,0,Math.PI/8);
      for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;sphere(.42,metal,Math.sin(a)*1.15,3.75,Math.cos(a)*1.15);}
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2,s=Math.sin(a),c=Math.cos(a);
        const arm=box(.25,.15,.7,dark,s*1.6,3.3,c*1.6);arm.rotation.y=a;
        for(const t of [-.3,.3]){const x=s*1.85+c*t,z=c*1.85-s*t;bell(x,z,.16,3,.35,.35,Math.atan2(z,x));}
      }
      box(1.7,.5,1.1,shell,0,1.55,0); box(1.75,.06,1.15,dark,0,1.82,0);
      for(const x of [-.75,0,.75])for(const z of [-1,1]){wheel(x,.95,z*.68,.24,.22);strut(V(x,.95,z*.62),V(x*.5,1.35,z*.5),.035,metal);}
      const rtg=cylinder(.2,.2,.6,dark,-1.05,1.75,0,structure,12); rtg.rotation.z=.6;
      cylinder(.06,.06,.75,shell,.6,2.2,.3,structure,10); box(.32,.2,.22,dark,.6,2.65,.3);
      strut(V(.85,1.5,-.3),V(1.2,1.15,-.2),.04,metal);
      for(const x of [-1,1])for(const z of [-1,1])strut(V(x*.6,1.85,z*.4),V(x*.5,3.32,z*.4),.012,metal);
      return {radius:1.55,hipY:2.9,braceY:2.2,wingX:1.95,wingY:3.55,roof:3.83,antenna:[0,0],mast:[0,.55],sensor:{face:Math.PI/2,r:1,y:1.35},nozzleY:3,flameR:.9};
    },
  };
  const frame=(bodies[spec.vehicleId??'']??prototype)();
  // Moving parts (legs and arrays) are built apart from the static body and baked one draw call each.
  const moving=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.55,roughness:.42}); materials.push(moving);
  // Articulated legs: chrome piston, sleeve, braces, pivot and layered footpad. Each leg hinges at
  // its hip; folded, it points almost straight up beside the body so the lander fits the fairing.
  const legs:{pivot:THREE.Group;axis:THREE.Vector3;fold:number}[]=[];
  for(let k=0;k<gear.legs;k++) {
    const a=Math.PI/gear.legs+k*2*Math.PI/gear.legs,cx=Math.cos(a),sz=Math.sin(a);
    const foot=new THREE.Vector3(cx*gear.radius,.14,sz*gear.radius);
    const hip=new THREE.Vector3(cx*frame.radius,frame.hipY,sz*frame.radius), knee=hip.clone().lerp(foot,.54);
    const pivot=new THREE.Group(), at=(v:THREE.Vector3)=>v.clone().sub(hip), f=at(foot), kn=at(knee);
    strut(new THREE.Vector3(),kn,.115,shell,pivot); strut(kn,f,.065,metal,pivot);
    strut(at(new THREE.Vector3(cx*frame.radius,frame.braceY,sz*frame.radius)),f,.055,dark,pivot);
    add(new THREE.SphereGeometry(.15,12,8),accent,kn.x,kn.y,kn.z,pivot);
    cylinder(gear.pad*.86,gear.pad,.1,dark,f.x,.05-hip.y,f.z,pivot,16);
    cylinder(gear.pad*.65,gear.pad*.83,.065,metal,f.x,.13-hip.y,f.z,pivot,16);
    cylinder(.13,.18,.13,accent,f.x,.21-hip.y,f.z,pivot,12);
    bakeColoured(pivot,moving); pivot.position.copy(hip);
    // swing outwards and up until the leg stands 10 degrees off vertical
    const fold=THREE.MathUtils.degToRad(170)-Math.atan2(Math.hypot(f.x,f.z),-f.y);
    legs.push({pivot,axis:new THREE.Vector3(-sz,0,cx),fold});
  }
  const arrayId=spec.solarArrayId, sections=arrayId==='extended'?3:arrayId==='compact'?1:2;
  const span=arrayId==='compact'?.82:.88;
  const wings:{wing:THREE.Group;open:number;shut:number}[]=[];
  for(const side of [-1,1]) {
    const wing=new THREE.Group(); wing.position.set(side*frame.wingX,frame.wingY,0);
    wings.push({wing,open:side*(arrayId==='compact'?-.48:-.13),shut:side*1.48});
    strut(new THREE.Vector3(-side*.5,0,0),new THREE.Vector3(side*.2,0,0),.065,metal,wing);
    for(let section=0;section<sections;section++) {
      const x=side*(span/2+section*(span+.07));
      box(span,.085,1.16,metal,x,0,0,wing); box(span-.055,.025,1.1,dark,x,.052,0,wing);
      for(let col=0;col<3;col++)for(let row=0;row<5;row++) {
        const cellX=x-span/2+.045+(col+.5)*(span-.09)/3;
        box((span-.09)/3-.015,.012,.19,cell,cellX,.072,-.42+row*.21,wing);
      }
      box(.07,.12,.28,dark,side*(section*(span+.07)),0,0,wing);
    }
    bakeColoured(wing,moving);
  }
  const antenna=new THREE.Group(); antenna.position.set(frame.antenna[0],frame.roof+.2,frame.antenna[1]); structure.add(antenna);
  cylinder(.09,.14,.35,metal,0,.14,0,antenna);
  if(spec.antennaId==='relay') {
    box(1.35,.08,.08,metal,0,.55,0,antenna);
    for(const side of [-1,1]) {box(.5,.67,.1,dark,side*.42,.66,0,antenna);box(.44,.6,.04,shell,side*.42,.66,.07,antenna);for(let i=0;i<4;i++)box(.36,.015,.012,accent,side*.42,.46+i*.13,.1,antenna);}
  } else if(spec.antennaId==='whip') {
    for(const side of [-1,1]) {cylinder(.07,.11,.2,dark,side*.35,.1,0,antenna);strut(new THREE.Vector3(side*.35,.2,0),new THREE.Vector3(side*.52,1.15,0),.022,metal,antenna);}
  } else {
    const dish=new THREE.Group();dish.position.y=.4;dish.rotation.z=-.45;antenna.add(dish);
    const reflector=add(new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.14,.02),new THREE.Vector2(.3,.09),new THREE.Vector2(.48,.23)],24),shell,0,0,0,dish);
    // Separate backing makes the reflector visible from both sides without changing the hull material.
    const backing=shell.clone();backing.side=THREE.DoubleSide;reflector.material=backing;materials.push(backing);
    for(const side of [-1,1])strut(new THREE.Vector3(side*.45,.23,0),new THREE.Vector3(0,.57,0),.018,metal,dish);
    cylinder(.045,.06,.12,dark,0,.57,0,dish,12);
  }
  if(spec.hazardSensor && spec.hazardSensor!=='none') {
    const {face,r,y}=frame.sensor, sensor=new THREE.Group();
    sensor.position.set(Math.sin(face)*r,y,Math.cos(face)*r); sensor.rotation.y=face; structure.add(sensor);
    box(.62,.38,.18,dark,0,0,0,sensor);
    const lens=(x:number,y:number,r:number,tiltX=Math.PI/2,tiltZ=0)=>{const mesh=cylinder(r,r*1.2,.13,glass,x,y,.15,sensor,16);mesh.rotation.set(tiltX,0,tiltZ);return mesh;};
    const kind=spec.hazardSensor;
    if(kind==='camera')for(const x of [-.17,.17])lens(x,0,.1);
    // crew window: an angled pane with the Landing Point Designator's reticle lines
    else if(kind==='crew-window'){const pane=box(.5,.3,.03,glass,0,.02,.11,sensor);pane.rotation.x=-.35;for(let i=0;i<4;i++)box(.42,.012,.01,accent,0,-.08+i*.06,.13,sensor);}
    // landing radar: a flat antenna plate tilted towards the ground, in a grid of elements
    else if(kind==='landing-radar'){const plate=box(.56,.5,.05,metal,0,-.05,.14,sensor);plate.rotation.x=.5;for(let i=0;i<4;i++)for(let j=0;j<4;j++)box(.1,.09,.012,dark,-.18+i*.12,-.2+j*.11,.17,sensor).rotation.x=.5;}
    // laser 3D imager: a large receiver lens beside a small emitter
    else if(kind==='flash-lidar'){lens(-.12,0,.15);lens(.2,.06,.07);cylinder(.17,.17,.04,metal,-.12,0,.23,sensor,16).rotation.x=Math.PI/2;}
    // hazard camera with the three small telescopes of a laser Doppler velocimeter
    else if(kind==='hazard-camera'){lens(-.14,0,.12);for(const [x,y] of [[.14,.09],[.22,-.06],[.07,-.08]])lens(x,y,.04,Math.PI/2+.25);}
    // terrain-relative navigation: a camera tube looking down and ahead
    else if(kind==='terrain-nav'){const tube=cylinder(.09,.11,.42,glass,0,-.05,.2,sensor,16);tube.rotation.x=Math.PI/2+.7;cylinder(.13,.13,.06,metal,0,.08,.08,sensor,16).rotation.x=Math.PI/2+.7;}
    // Doppler lidar: three splayed telescopes, one per beam
    else if(kind==='doppler-lidar')for(const [x,tz] of [[-.18,-.35],[0,0],[.18,.35]])lens(x,-.02,.06,Math.PI/2+.45,tz);
    else {cylinder(.19,.19,.24,glass,0,.18,.07,sensor);cylinder(.23,.23,.055,metal,0,.32,.07,sensor);}
  }
  batchStatic(structure);
  legs.forEach(leg=>structure.add(leg.pivot)); wings.forEach(w=>structure.add(w.wing));
  const setGear=(deployed:number)=>{const d=THREE.MathUtils.clamp(deployed,0,1);legs.forEach(leg=>leg.pivot.quaternion.setFromAxisAngle(leg.axis,(1-d)*leg.fold));};
  const setArrays=(deployed:number)=>{const d=THREE.MathUtils.clamp(deployed,0,1);wings.forEach(w=>{w.wing.rotation.z=THREE.MathUtils.lerp(w.shut,w.open,d);});};
  setGear(1); setArrays(1);
  // Dispose unselected materials, which scene traversal would otherwise never reach.
  const used=new Set<THREE.Material>();
  structure.traverse(o=>{if(o instanceof THREE.Mesh)used.add(o.material as THREE.Material);});
  materials.forEach(material=>{if(!used.has(material))material.dispose();});
  const mast=new THREE.Group();mast.position.set(frame.mast[0],frame.roof+.1,frame.mast[1]);mast.scale.y=.001;g.add(mast);
  cylinder(.035,.05,2.4,shell,0,1.2,0,mast,8);
  const beaconMat=new THREE.MeshBasicMaterial({color:0x113322,fog:false});
  const beaconTip=add(new THREE.SphereGeometry(.14,12,8),beaconMat,0,2.45,0,mast);
  const flame=add(new THREE.ConeGeometry(frame.flameR,3.4,14,1,true),new THREE.MeshBasicMaterial({color:0xffd9a0,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}),0,frame.nozzleY,0,g);
  flame.geometry.rotateX(Math.PI);flame.geometry.translate(0,-1.7,0);flame.visible=false;
  return {group:g,flame,mast,beaconTip,beaconMat,nozzleY:frame.nozzleY,footRadius:gear.radius,debrisColors:[colours.hull,colours.shell,0x252b32,colours.accent],setGear,setArrays};
}
