import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw } from 'lucide-react';

interface Point { id: string; name: string; lat: number; lon: number }
interface Props { body: 'Moon' | 'Mars' | 'Earth'; points: Point[]; selected: string; onSelect: (id: string) => void }
function position(lat: number, lon: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat), theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}
// Deterministic illustrative Mars material, never presented as an observation.
function marsTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#a85f42'; ctx.fillRect(0, 0, 1024, 512);
  let seed = 37;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 6000; i++) {
    const x = random() * 1024, y = random() * 512, r = random() * 30 + 1;
    ctx.fillStyle = `rgba(${random() > 0.5 ? '48,24,20' : '228,165,112'},${random() * 0.09})`;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
export default function Globe({ body, points, selected, onSelect }: Props) {
  const mount = useRef<HTMLDivElement>(null), select = useRef(onSelect);
  const focus = useRef<(id: string) => void>(() => {});
  const [error, setError] = useState(false);
  const [reset, setReset] = useState(0);
  select.current = onSelect;
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); } catch { setError(true); return; }
    setError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', `${body} globe. Drag to rotate, scroll to zoom. Site buttons are available in the adjacent panel.`);
    renderer.domElement.setAttribute('role', 'img');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const initial = points.find(p => p.id === selected) ?? points[0];
    camera.position.copy(position(initial.lat * 0.55, initial.lon, 4.2));
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2.7; controls.maxDistance = 6;
    controls.enableZoom = true; controls.rotateSpeed = 0.6;
    const material = new THREE.MeshStandardMaterial({ color: body === 'Earth' ? 0xc4d6e9 : 0xd4cebf, roughness: 1 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.25, 80, 64), material); scene.add(globe);
    let texture: THREE.Texture | undefined, disposed = false;
    if (body === 'Mars') { texture = marsTexture(); material.map = texture; }
    else new THREE.TextureLoader().load(`/textures/${body.toLowerCase()}.jpg`, tex => {
      if (disposed) { tex.dispose(); return; }
      texture = tex; tex.colorSpace = THREE.SRGBColorSpace; material.map = tex; material.needsUpdate = true;
    });
    scene.add(new THREE.AmbientLight(0xbacfe5, 1.3));
    const sun = new THREE.DirectionalLight(0xfff5e7, 2.4); sun.position.set(-3, 4, 5); scene.add(sun);
    const grid = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.259, 24, 12)),
      new THREE.LineBasicMaterial({ color: 0x8acccf, transparent: true, opacity: 0.055 })); scene.add(grid);
    const pickTargets: THREE.Mesh[] = [];
    const markers = points.map(p => {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 12), new THREE.MeshBasicMaterial({ color: p.id === selected ? 0x9ff9e8 : 0xe8f0f7 }));
      marker.position.copy(position(p.lat, p.lon, 1.285)); marker.userData.id = p.id; scene.add(marker);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.046, 0.055, 32), new THREE.MeshBasicMaterial({ color: 0x8ee5d9, side: THREE.DoubleSide }));
      ring.position.copy(position(p.lat, p.lon, 1.28)); ring.lookAt(position(p.lat, p.lon, 3)); scene.add(ring);
      // A forgiving click target, still occluded by the globe on its far side.
      const pickTarget = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      pickTarget.position.copy(marker.position); pickTarget.userData.id = p.id; scene.add(pickTarget); pickTargets.push(pickTarget);
      return marker;
    });
    let destination: THREE.Vector3 | null = null;
    focus.current = id => {
      const point = points.find(p => p.id === id); if (!point) return;
      destination = position(point.lat * 0.85, point.lon, camera.position.length());
      markers.forEach(marker => { marker.material.color.set(marker.userData.id === id ? 0x9ff9e8 : 0xe8f0f7); marker.scale.setScalar(marker.userData.id === id ? 1.6 : 1); });
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { camera.position.copy(destination); destination = null; }
    };
    const cancelFocus = () => { destination = null; }; controls.addEventListener('start', cancelFocus);
    const ray = new THREE.Raycaster(); let pointerDown = { x: 0, y: 0 };
    const down = (event: PointerEvent) => { pointerDown = { x: event.clientX, y: event.clientY }; };
    const click = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = ray.intersectObjects([globe, ...pickTargets])[0];
      if (hit?.object.userData.id) select.current(hit.object.userData.id);
    };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', click);
    const resize = new ResizeObserver(() => {
      const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    }); resize.observe(host);
    let frame = 0;
    const render = () => {
      if (destination) { camera.position.lerp(destination, 0.07); if (camera.position.distanceTo(destination) < 0.005) destination = null; }
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render);
    }; render();
    return () => {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); texture?.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', click);
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) { object.geometry.dispose(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach(m => m.dispose()); } });
      renderer.dispose(); renderer.domElement.remove(); focus.current = () => {};
    };
    // Selection changes use focus(), without rebuilding the WebGL scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, points, reset]);
  useEffect(() => { focus.current(selected); }, [selected, body, reset]);
  return <div className="globe-view">
    <div ref={mount} className="globe-canvas" />
    {error && <div className="globe-error">3D view is unavailable on this device. Use the site list to continue.</div>}
    <div className="globe-caption"><span>{body === 'Earth' ? 'Click a site · Drag to orbit · Scroll to zoom' : 'Drag to orbit · Scroll to zoom'}</span><button className="icon-button" onClick={() => setReset(v => v + 1)} aria-label="Reset globe view"><RotateCcw size={15} /></button></div>
    <span className="globe-disclaimer">{body === 'Mars' ? 'Illustrative surface' : 'Reference globe'} · Approximate site locators</span>
  </div>;
}
