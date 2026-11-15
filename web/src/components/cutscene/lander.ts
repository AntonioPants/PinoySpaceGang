import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { liveries, type LanderAppearance } from '../../lib/landerAppearance';

/** Shared by the hangar, cinematics and live descent. Old missions use the default appearance. */
export interface LanderSpec extends LanderAppearance { vehicleId?: string; landingGearId?: string; hazardSensor?: 'lidar' | 'camera' | 'none' }
export const GEAR: Record<string, { legs: number; radius: number; pad: number }> = {
  'standard-four': { legs: 4, radius: 3, pad: 0.42 },
  'wide-four': { legs: 4, radius: 3.8, pad: 0.55 },
  'survey-six': { legs: 6, radius: 3.3, pad: 0.5 },
};
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

/** Engineered, illustrative lander. Attachments are cosmetic; gear retains its physical footprint. */
export function buildLander(spec: LanderSpec = {}): Lander {
  const g = new THREE.Group(), structure = new THREE.Group(); g.add(structure);
  const payload = spec.vehicleId === 'payload';
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
  const bellMat=dark.clone(); bellMat.side=THREE.DoubleSide; materials.push(bellMat);
  add(new THREE.LatheGeometry(bellPoints,32),bellMat);
  ring(payload?.82:.69,.045,metal,.69);
  for(let i=0;i<4;i++)ring(.29+i*.028,.025,metal,1.38-i*.075);
  for(const x of [-1,1])strut(new THREE.Vector3(x*.43,1.45,0),new THREE.Vector3(x*.8,1.9,0),.065,metal);
  if(payload)for(const z of [-1,1]) {
    const tank=add(new THREE.CapsuleGeometry(.48,.6,6,16),shell,0,2.5,z*2.05);
    cylinder(.5,.5,.12,accent,0,2.5,z*2.05);
    for(const y of [2.15,2.85])strut(new THREE.Vector3(0,y,z*1.5),new THREE.Vector3(0,y,tank.position.z),.08,dark);
  }
  // Moving parts (legs and arrays) are built apart from the static body and baked one draw call each.
  const moving=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.55,roughness:.42}); materials.push(moving);
  // Articulated legs: chrome piston, sleeve, braces, pivot and layered footpad. Each leg hinges at
  // its hip; folded, it points almost straight up beside the body so the lander fits the fairing.
  const legs:{pivot:THREE.Group;axis:THREE.Vector3;fold:number}[]=[];
  for(let k=0;k<gear.legs;k++) {
    const a=Math.PI/gear.legs+k*2*Math.PI/gear.legs,cx=Math.cos(a),sz=Math.sin(a);
    const foot=new THREE.Vector3(cx*gear.radius,.14,sz*gear.radius);
    const hip=new THREE.Vector3(cx*radius,bodyY+.35,sz*radius), knee=hip.clone().lerp(foot,.54);
    const pivot=new THREE.Group(), at=(v:THREE.Vector3)=>v.clone().sub(hip), f=at(foot), kn=at(knee);
    strut(new THREE.Vector3(),kn,.115,shell,pivot); strut(kn,f,.065,metal,pivot);
    strut(at(new THREE.Vector3(cx*radius,bodyY-.6,sz*radius)),f,.055,dark,pivot);
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
    const wing=new THREE.Group(); wing.position.set(side*(radius+.35),upperY-.35,0);
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
  const antenna=new THREE.Group(); antenna.position.set(.42,roof+.2,.2); structure.add(antenna);
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
    // The payload body's tanks sit fore and aft (±z), so its sensor faces +x, clear of them.
    const face=payload?Math.PI/2:0, sensor=new THREE.Group();
    sensor.position.set(Math.sin(face)*(radius+.17),bodyY-.15,Math.cos(face)*(radius+.17)); sensor.rotation.y=face; structure.add(sensor);
    box(.62,.38,.18,dark,0,0,0,sensor);
    if(spec.hazardSensor==='camera')for(const x of [-.17,.17]) {
      const lens=cylinder(.1,.12,.13,glass,x,0,.15,sensor,16);lens.rotation.x=Math.PI/2;
    } else {cylinder(.19,.19,.24,glass,0,.18,.07,sensor);cylinder(.23,.23,.055,metal,0,.32,.07,sensor);}
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
  const mast=new THREE.Group();mast.position.y=roof+.1;mast.scale.y=.001;g.add(mast);
  cylinder(.035,.05,2.4,shell,0,1.2,0,mast,8);
  const beaconMat=new THREE.MeshBasicMaterial({color:0x113322,fog:false});
  const beaconTip=add(new THREE.SphereGeometry(.14,12,8),beaconMat,0,2.45,0,mast);
  const flame=add(new THREE.ConeGeometry(payload?.75:.6,3.4,14,1,true),new THREE.MeshBasicMaterial({color:0xffd9a0,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}),0,.7,0,g);
  flame.geometry.rotateX(Math.PI);flame.geometry.translate(0,-1.7,0);flame.visible=false;
  return {group:g,flame,mast,beaconTip,beaconMat,nozzleY:.7,footRadius:gear.radius,debrisColors:[colours.hull,colours.shell,0x252b32,colours.accent],setGear,setArrays};
}
