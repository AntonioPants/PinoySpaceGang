import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Minus, Plus, RotateCcw, Mountain } from 'lucide-react';
import type { TerrainProfile } from '../lib/types';

export default function TerrainExplorer({ profile }: { profile: TerrainProfile }) {
  const host = useRef<HTMLDivElement>(null), commands = useRef<(action: string) => void>(() => {});
  const [exaggeration, setExaggeration] = useState(1), [error, setError] = useState('');
  const [preset, setPreset] = useState('auto');
  const [sample, setSample] = useState<number | null>(null);
  useEffect(() => {
    const mount = host.current!; let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setError('3D is unavailable. The measured terrain profile remains available beside this view.'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x111f2d);
    renderer.domElement.setAttribute('role', 'img'); renderer.domElement.setAttribute('aria-label', `${profile.manifest.name} measured 3D terrain. Drag to orbit, scroll to zoom, right-drag to pan, click to inspect elevation.`);
    mount.append(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, 2, 30000);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    controls.minDistance = 100; controls.maxDistance = 14000; controls.maxPolarAngle = Math.PI / 2 - 0.025;
    controls.zoomToCursor = true;
    const { rows, columns, spacing_m: step } = profile.manifest.grid;
    const width = (columns - 1) * step, depth = (rows - 1) * step;
    const base = profile.manifest.local_frame.vertical_offset_m;
    const view = new DataView(profile.buffer), positions = new Float32Array(rows * columns * 3), colors = new Float32Array(rows * columns * 3);
    const indices: number[] = [], low = new THREE.Color('#625e47'), high = new THREE.Color('#c8bda1');
    const samples = Array.from({length:rows*columns}, (_, i) => view.getFloat32(i*4,true));
    const min = Math.min(...samples), range = Math.max(...samples) - min || 1;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const i = row * columns + col;
      positions.set([col * step - width / 2, samples[i] - base, row * step - depth / 2], i * 3);
      const color = low.clone().lerp(high, (samples[i] - min) / range); colors.set([color.r, color.g, color.b], i * 3);
      if (row < rows - 1 && col < columns - 1) indices.push(i, i + columns, i + 1, i + 1, i + columns, i + columns + 1);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions,3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors,3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({vertexColors:true, roughness:1, side:THREE.DoubleSide})); scene.add(mesh);
    const grid = new THREE.GridHelper(6000,12,0x466071,0x283c4b); grid.position.y = -8; scene.add(grid);
    scene.add(new THREE.HemisphereLight(0xddeeff,0x655342,2));
    const sun = new THREE.DirectionalLight(0xfff1d2,3); sun.position.set(-3000,4000,-1000); scene.add(sun);
    const reset = () => { camera.position.set(5200,3400,5800); controls.target.set(0,45,0); controls.update(); };
    reset();
    const homeDistance = camera.position.distanceTo(controls.target);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let desiredDistance: number | null = null;
    const cancelZoom = () => { desiredDistance = null; setPreset('auto'); };
    controls.addEventListener('start', cancelZoom);
    commands.current = action => {
      if (action === 'reset') { desiredDistance = null; setPreset('auto'); reset(); }
      else if (action === 'top') { desiredDistance = null; setPreset('auto'); camera.position.set(0,homeDistance,0.1); controls.target.set(0,45,0); }
      else if (action.startsWith('preset:')) desiredDistance = homeDistance / Number(action.slice(7));
      else if (action === 'auto') { setPreset('auto'); }
      else { setPreset('auto'); desiredDistance = THREE.MathUtils.clamp((desiredDistance ?? camera.position.distanceTo(controls.target)) * (action === 'in' ? 0.7 : 1.4), controls.minDistance, controls.maxDistance); }
      controls.update();
    };
    const ray = new THREE.Raycaster(); let down = { x:0, y:0 };
    const onDown = (e:PointerEvent) => { down = {x:e.clientX,y:e.clientY}; };
    const onUp = (e:PointerEvent) => {
      if (Math.hypot(e.clientX-down.x,e.clientY-down.y)>5) return;
      const rect = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
      const hit = ray.intersectObject(mesh)[0]; if(hit) setSample(hit.point.y / mesh.scale.y + base);
    };
    renderer.domElement.addEventListener('pointerdown',onDown); renderer.domElement.addEventListener('pointerup',onUp);
    const resize = new ResizeObserver(() => { if (!mount.clientWidth || !mount.clientHeight) return; renderer.setSize(mount.clientWidth,mount.clientHeight); camera.aspect = mount.clientWidth/mount.clientHeight; camera.updateProjectionMatrix(); }); resize.observe(mount);
    let frame = 0, lastTime = performance.now(), lastReadout = 0;
    const render = () => {
      const now = performance.now(), dt = Math.min((now - lastTime) / 1000, 0.1); lastTime = now;
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-8 * dt);
      if (desiredDistance !== null) {
        const offset = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.lerp(offset.length(), desiredDistance, blend);
        camera.position.copy(controls.target).add(offset.setLength(distance));
        if (Math.abs(distance - desiredDistance) < 0.5) desiredDistance = null;
      }
      controls.update();
      // Zoom and height exaggeration are linked continuously, never snapped between presets.
      const desiredScale = THREE.MathUtils.clamp(homeDistance / camera.position.distanceTo(controls.target), 1, 6);
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, desiredScale, blend);
      if (now - lastReadout > 100) { setExaggeration(Math.round(mesh.scale.y * 100) / 100); lastReadout = now; }
      renderer.render(scene,camera); frame=requestAnimationFrame(render);
    }; render();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); geometry.dispose(); mesh.material.dispose(); grid.geometry.dispose(); const materials=Array.isArray(grid.material)?grid.material:[grid.material]; materials.forEach(m=>m.dispose()); renderer.dispose(); renderer.domElement.remove(); commands.current=()=>{}; };
  },[profile]);
  return <div className="terrain-explorer"><div ref={host} className="terrain-canvas" />
    <div className="terrain-toolbar"><span><Mountain size={14} /> {profile.manifest.name} · {((profile.manifest.grid.columns - 1) * profile.sampleSpacingM / 1000).toFixed(1)} km patch</span><div><button aria-label="Zoom into terrain" onClick={()=>commands.current('in')}><Plus size={17}/></button><button aria-label="Zoom out of terrain" onClick={()=>commands.current('out')}><Minus size={17}/></button><button aria-label="Reset terrain camera" onClick={()=>commands.current('reset')}><RotateCcw size={15}/></button><button onClick={()=>commands.current('top')}>Top</button></div></div>
    {error && <p className="globe-error">{error}</p>}
    <div className="terrain-readout"><label htmlFor="height-scale">Zoom view <select id="height-scale" value={preset} onChange={e=>{setPreset(e.target.value);commands.current(e.target.value === 'auto' ? 'auto' : `preset:${e.target.value}`);}}><option value="auto">Zoom-linked</option><option value="1">1× · True scale</option><option value="3">3× · Exaggerated</option><option value="6">6× · Exaggerated</option></select></label><span aria-live="off">Height scale: {exaggeration.toFixed(2)}×</span><span>{sample === null ? 'Click terrain to inspect height' : `Elevation ≈ ${sample.toFixed(0)} m EGM2008`}</span></div>
    <div className="terrain-footnote">Drag to orbit · Scroll to zoom · Right-drag to pan<br/>Zoom smoothly adjusts displayed heights from 1× to 6×. Measured 30 m grid; elevation tint, not imagery. {exaggeration > 1 && <strong>Heights exaggerated {exaggeration.toFixed(2)}×; measurements stay at true scale.</strong>}</div>
  </div>;
}
