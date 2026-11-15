/** Isolated manual/browser-test harness; never imported by the application. */
import {createRoot} from 'react-dom/client';
import {StrictMode} from 'react';
import TerrainComparison3D from '../TerrainComparison3D';
import {loadProfile} from '../../../lib/mission';
const root=createRoot(document.getElementById('terrain-preview')!);
const [earth,target]=await Promise.all([
  loadProfile(undefined,'/terrain/kilbourne-hole-v1/manifest.json','kilbourne-hole-v1','earth'),
  loadProfile(undefined,'/terrain/shackleton-rim/manifest.json','shackleton-rim','moon'),
]);
function show(synthetic=false){root.render(<StrictMode><TerrainComparison3D earthProfile={earth} targetProfile={synthetic?null:target}
  targetMetadata={{id:'shackleton-rim',name:'Shackleton rim',body:'moon',latitude:-89.9,reliefM:300,meanSlopeDeg:5,roughnessM:30}}
  touchdown={{x:0,y:0,footprintRadiusM:2}} rehearsalPoints={[{x:200,y:300,footprintRadiusM:2}]}/></StrictMode>);}
show();
Object.assign(window,{terrainPreview:{synthetic:()=>show(true),real:()=>show(false),unmount:()=>root.unmount()}});
