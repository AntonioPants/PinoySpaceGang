import * as THREE from 'three';
import {heightAt,type TerrainData} from './data';
export interface TerrainMarker {
  /** Metres from patch centre: x east, y north (physics convention). */
  x:number;y:number;label?:string;footprintRadiusM?:number;
}
export function makeTerrainScene(data:TerrainData,markers:TerrainMarker[]){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#0a0c0f');
  const positions=new Float32Array(data.heights.length*3),natural=new Float32Array(positions.length),heat=new Float32Array(positions.length);
  const base=new THREE.Color(data.tint),green=new THREE.Color('#22c55e'),amber=new THREE.Color('#f59e0b'),red=new THREE.Color('#ef4444'),unknown=new THREE.Color('#64748b');
  const indices:number[]=[];
  for(let r=0;r<data.rows;r++)for(let c=0;c<data.columns;c++){
    const i=r*data.columns+c,h=data.heights[i];
    positions.set([c*data.dx-data.width/2,Number.isFinite(h)?h-data.mean:0,r*data.dy-data.depth/2],3*i);
    base.toArray(natural,3*i);
    const s=data.slopes[i];(Number.isFinite(s)?s<3?green:s<=5?amber:red:unknown).toArray(heat,3*i);
    if(r<data.rows-1&&c<data.columns-1){const corners=[i,i+1,i+data.columns,i+data.columns+1];
      if(corners.every(j=>Number.isFinite(data.heights[j])))indices.push(i,i+data.columns,i+1,i+1,i+data.columns,i+data.columns+1);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.setAttribute('color',new THREE.BufferAttribute(natural,3));
  const lit=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const flat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const mesh=new THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial|THREE.MeshBasicMaterial>(geometry,lit);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  const wire=new THREE.LineSegments(new THREE.WireframeGeometry(geometry),new THREE.LineBasicMaterial({color:'#c6d4db',transparent:true,opacity:.25}));wire.visible=false;scene.add(wire);
  scene.add(new THREE.AmbientLight('#dbe5f0',data.body==='moon'?.18:.65));
  const span=Math.max(data.width,data.depth,data.relief),sun=new THREE.DirectionalLight('#fff5e6',2.4);
  const elevation=THREE.MathUtils.degToRad(data.sunElevation),azimuth=THREE.MathUtils.degToRad(data.sunAzimuth);
  sun.position.set(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),-Math.cos(azimuth)*Math.cos(elevation)).multiplyScalar(span*2);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-span;
  sun.shadow.camera.right=sun.shadow.camera.top=span;sun.shadow.camera.near=.1;sun.shadow.camera.far=span*5;sun.shadow.normalBias=Math.max(.05,data.dx*.01);scene.add(sun);
  let omitted=0;
  for(const marker of markers){
    const y=heightAt(data,marker.x,marker.y);
    if(y===null){omitted++;continue;}
    const radius=Number.isFinite(marker.footprintRadiusM)&&marker.footprintRadiusM!>0?marker.footprintRadiusM!:2;
    const ringPoints:THREE.Vector3[]=[];
    for(let i=0;i<=64;i++){
      const a=i/64*Math.PI*2,x=marker.x+Math.cos(a)*radius,north=marker.y+Math.sin(a)*radius;
      ringPoints.push(new THREE.Vector3(x,(heightAt(data,x,north)??y)+.15,-north));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints),new THREE.LineBasicMaterial({color:'#22c55e'})));
    const beacon=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(marker.x,y,-marker.y),new THREE.Vector3(marker.x,y+span*.08,-marker.y)]),new THREE.LineBasicMaterial({color:'#22c55e',transparent:true,opacity:.8}));scene.add(beacon);
    const dot=new THREE.Mesh(new THREE.SphereGeometry(span/500,8,6),new THREE.MeshBasicMaterial({color:'#22c55e'}));dot.position.set(marker.x,y+span*.08,-marker.y);scene.add(dot);
  }
  return {scene,omitted,setMode(heatmap:boolean,wireframe:boolean){mesh.material=heatmap?flat:lit;geometry.setAttribute('color',new THREE.BufferAttribute(heatmap?heat:natural,3));wire.visible=wireframe;},
    dispose(){scene.traverse(object=>{const drawable=object as THREE.Mesh;if(drawable.geometry)drawable.geometry.dispose();if(drawable.material)(Array.isArray(drawable.material)?drawable.material:[drawable.material]).forEach(m=>m.dispose());});lit.dispose();flat.dispose();sun.shadow.map?.dispose();sun.shadow.mapPass?.dispose();scene.clear();}};
}
