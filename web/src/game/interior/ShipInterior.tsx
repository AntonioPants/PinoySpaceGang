import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import type { ControlCenterProps } from '../contracts';
import SystemsConsole from '../SystemsConsole';
import { buildAstronaut } from './astronaut';
import { buildCabin } from './cabin';
import { buildChecklist } from './checklist';
import { buildSpace } from './exterior';
import { leaveHandoff } from '../../components/cutscene/engine';
import LaunchMenu from './LaunchMenu';
import { ThirdPerson, type Mode, type Target } from './player';
import { ROOM, SCREEN, SEAT, STATIONS, type StationId } from './stations';
import EquipmentScreen from './screens/EquipmentScreen';
import FlightConfigScreen from './screens/FlightConfigScreen';
import MissionControlScreen from './screens/MissionControlScreen';
import './interior.css';

/** Size of each monitor's page in CSS pixels; scaled to SCREEN metres in the scene. */
const PAGE = { width: 840, height: Math.round(840 * SCREEN.heightM / SCREEN.widthM) };

/**
 * The control centre: the bridge of the ship, in third person. The player walks an astronaut
 * round the bridge, sets up the mission on three glowing monitors, then sits in the pilot's seat
 * to start it. The monitors are real pages placed in the 3D scene, so their sliders, switches
 * and drop-downs work with mouse and keyboard. The flat console stays one click away, and is
 * used automatically when 3D cannot start or the window is phone-sized.
 */
export default function ShipInterior(props: ControlCenterProps) {
  const [flat, setFlat] = useState(false);
  // Phones get the same bridge with one change: a monitor's page opens as a sheet over the view
  // instead of being read on the 3D screen, where it would be far too small to use.
  const [compact] = useState(() => window.innerWidth < 760);
  const [failure, setFailure] = useState('');
  if (flat || failure) return <div className="ship-interior-flat">
    <p className="field-help" role="status">{failure ? `The 3D bridge could not start (${failure}). Showing the flat console.` : 'Flat console view.'}{' '}
      {!failure && <button className="text-button" onClick={() => setFlat(false)}>Enter the bridge</button>}</p>
    <SystemsConsole {...props} />
  </div>;
  return <Bridge {...props} compact={compact} onFlat={() => setFlat(true)} onFailure={setFailure} />;
}

function Bridge({ mission, settings, onSettingsChange, onLaunch, onExit, error, weatherAvailable, weather, reducedMotion, compact, onFlat, onFailure }:
  ControlCenterProps & { compact: boolean; onFlat: () => void; onFailure: (reason: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<ThirdPerson | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'walk' });
  const [target, setTarget] = useState<Target | null>(null);
  // one page element per monitor; React renders into them, the scene places them
  const pages = useMemo(() => Object.fromEntries(STATIONS.map(s => {
    const el = document.createElement('div');
    el.className = `monitor-screen monitor-${s.id}`; el.dataset.station = s.id;
    el.style.width = `${PAGE.width}px`; el.style.height = `${PAGE.height}px`;
    el.setAttribute('role', 'group'); el.setAttribute('aria-label', `${s.title} monitor`);
    return [s.id, el];
  })) as Record<StationId, HTMLDivElement>, []);
  const body = mission.planetaryTarget.body;
  const fail = useRef(onFailure); fail.current = onFailure;
  const snap = useRef<(() => void) | null>(null);      // draws a frame and keeps it for the next scene's dissolve
  const motion = useRef(reducedMotion); motion.current = reducedMotion;

  useEffect(() => {
    const host = mount.current!;
    let webgl: THREE.WebGLRenderer;
    // On a high-density screen the pixels are already fine, and multisampling there costs more
    // than everything else in the scene put together on an integrated GPU.
    const dense = devicePixelRatio >= 1.5;
    try { webgl = new THREE.WebGLRenderer({ antialias: !dense, alpha: true, powerPreference: 'high-performance' }); }
    catch (e) { fail.current(e instanceof Error ? e.message : 'WebGL is not available'); return; }
    webgl.setPixelRatio(Math.min(devicePixelRatio, 2));
    webgl.setClearColor(0x000000, 0);
    webgl.toneMapping = THREE.ACESFilmicToneMapping; webgl.toneMappingExposure = 1.05;
    webgl.shadowMap.enabled = true; webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    webgl.domElement.className = 'cabin-canvas';
    // The monitor pages sit BEHIND the canvas. Each monitor is a see-through hole in the 3D
    // picture, so the astronaut and the furniture pass in front of the screens correctly.
    const css = new CSS3DRenderer();
    css.domElement.className = 'cabin-screens';
    // Focusing a control makes the browser scroll its page "into view", which would slide the
    // whole 3D layer sideways. Clipping (not hiding) overflow forbids that; the listener covers
    // browsers without overflow: clip.
    css.domElement.style.overflow = 'clip';
    const unscroll = (e: Event) => { const el = e.currentTarget as HTMLElement; if (el.scrollLeft || el.scrollTop) el.scrollTo(0, 0); };
    css.domElement.addEventListener('scroll', unscroll); host.addEventListener('scroll', unscroll);
    host.append(css.domElement, webgl.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040b);
    const camera = new THREE.PerspectiveCamera(compact ? 78 : 58, 1, 0.1, 4000);   // portrait screens need a wider view
    const cabin = buildCabin(), space = buildSpace(body), astronaut = buildAstronaut();
    scene.add(cabin.group, space.group, astronaut.group);
    // Light: the Sun through the window (the only strong, warm light), the ceiling panels as a
    // soft overhead light that puts shadows under things, and a little neutral fill.
    const shadowed = (light: THREE.DirectionalLight, half: number, far: number, size: number) => {
      light.castShadow = true; light.shadow.mapSize.set(size, size); light.shadow.bias = -0.0004; light.shadow.normalBias = 0.03;
      const c = light.shadow.camera; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 0.05; c.far = far; c.updateProjectionMatrix();
      return light;
    };
    const sun = shadowed(new THREE.DirectionalLight(0xfff0dc, 4.2), 9, 70, 2048);
    sun.position.copy(space.sunDirection).multiplyScalar(32); sun.target.position.set(0, 1, 0);
    const overhead = shadowed(new THREE.DirectionalLight(0xfff6ec, 1.15), 7.5, 4, 2048);
    overhead.position.set(0, ROOM.heightM - 0.25, 0); overhead.target.position.set(0, 0, 0.001);     // starts below the ceiling, so the ceiling casts nothing
    scene.add(sun, sun.target, overhead, overhead.target, new THREE.HemisphereLight(0xf3efe8, 0x3a3b3d, 0.85));
    // two unshadowed side fills shade the walls; point lights here cost far more per pixel
    for (const sx of [-1, 1]) { const fill = new THREE.DirectionalLight(0xfff3e4, 0.55); fill.position.set(sx * 4, 5, 3 * sx); scene.add(fill); }

    const holeGeo = new THREE.PlaneGeometry(SCREEN.widthM, SCREEN.heightM);
    // writes "fully transparent" into the picture wherever a screen is the nearest thing
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, transparent: true, blending: THREE.NoBlending });
    // compact: the page is shown as a sheet, so the 3D monitor is just dark glass
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a0c0f, emissive: 0x1b2734, emissiveIntensity: 0.6, roughness: 0.25 });
    const mounted: THREE.Object3D[] = [];
    for (const station of STATIONS) {
      const { position, rotationY } = cabin.mounts[station.id];
      const hole = new THREE.Mesh(holeGeo, compact ? glassMat : holeMat); hole.position.copy(position); hole.rotation.y = rotationY;
      scene.add(hole); mounted.push(hole);
      if (compact) continue;
      const page = new CSS3DObject(pages[station.id]);
      page.position.copy(position); page.rotation.y = rotationY; page.scale.setScalar(SCREEN.widthM / PAGE.width);
      scene.add(page); mounted.push(page);
    }

    const tp = new ThirdPerson(host, {
      reducedMotion: motion.current,
      onMode: m => {
        setMode(m);
        if (m.kind === 'station') pages[m.id].querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true });
        else if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.monitor-screen')) document.activeElement.blur();
      },
      onTarget: setTarget,
    });
    player.current = tp;
    // tabbing into a monitor's controls brings the astronaut and the camera to that monitor
    const focusIn = (e: FocusEvent) => { const id = (e.currentTarget as HTMLElement).dataset.station as StationId; if (!(tp.mode.kind === 'station' && tp.mode.id === id)) tp.use(id); };
    for (const s of STATIONS) pages[s.id].addEventListener('focusin', focusIn);

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      webgl.setSize(w, h, false); css.setSize(w, h);
      camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();

    const maxRatio = Math.min(devicePixelRatio, 2);
    let raf = 0, last = performance.now(), prev = last, slow = 16, ratio = maxRatio, sinceChange = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      tp.setReducedMotion(motion.current);
      tp.update(dt);
      const seated = tp.mode.kind === 'seated';
      // seated: hips on the cushion and far enough forward that the backpack clears the seat back
      astronaut.group.position.set(tp.pos.x, seated ? SEAT.seatHeightM - 0.34 : 0, tp.pos.z - (seated ? 0.17 : 0));
      astronaut.group.rotation.y = -tp.heading;
      astronaut.animate(dt, tp.speed, seated);
      if (!motion.current) space.drift(dt);
      camera.position.set(tp.camera.x, tp.camera.y, tp.camera.z);
      camera.lookAt(tp.camera.tx, tp.camera.ty, tp.camera.tz);
      webgl.render(scene, camera); css.render(scene, camera);
      // keep it smooth on slow GPUs: drop the drawing resolution when frames run long, raise it again when there is room
      slow += ((now - prev) - slow) * 0.05; prev = now;
      if (++sinceChange > 45 && (slow > 24 && ratio > 0.75 || slow < 17.5 && ratio < maxRatio)) {
        ratio = Math.max(0.75, Math.min(maxRatio, ratio * (slow > 24 ? 0.8 : 1.15))); sinceChange = 0;
        webgl.setPixelRatio(ratio); webgl.setSize(host.clientWidth, host.clientHeight, false);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    snap.current = () => { try { webgl.render(scene, camera); leaveHandoff(webgl.domElement); } catch { /* the next scene starts from black */ } };

    return () => {
      snap.current = null;
      cancelAnimationFrame(raf); ro.disconnect(); host.removeEventListener('scroll', unscroll); tp.dispose(); player.current = null;
      for (const s of STATIONS) pages[s.id].removeEventListener('focusin', focusIn);
      for (const o of mounted) scene.remove(o);
      holeGeo.dispose(); holeMat.dispose(); glassMat.dispose(); cabin.dispose(); space.dispose(); astronaut.dispose();
      webgl.dispose(); webgl.forceContextLoss();
      webgl.domElement.remove(); css.domElement.remove();
    };
  }, [body, pages, compact]);

  const checks = buildChecklist({ mission, settings, weatherAvailable, weatherLoaded: !!weather, error });
  const using = mode.kind === 'station' ? STATIONS.find(s => s.id === mode.id)! : null;
  const screens: Record<StationId, ReactNode> = {
    mission: <MissionControlScreen mission={mission} settings={settings} checks={checks} />,
    equipment: <EquipmentScreen mission={mission} settings={settings} onSettingsChange={onSettingsChange} />,
    config: <FlightConfigScreen mission={mission} settings={settings} onSettingsChange={onSettingsChange} weatherAvailable={weatherAvailable} weather={weather} />,
  };
  return <section className={`ship-interior${compact ? ' compact' : ''}`} aria-label="Ship's bridge">
    <div className="cabin-toolbar">
      <div><strong>Bridge</strong><small>Outbound from {body === 'Moon' ? 'the Moon' : 'Mars'} · {mission.planetaryTarget.name} → {mission.earthAnalog.name}</small></div>
      <div role="group" aria-label="Go to">
        {STATIONS.map(s => <button key={s.id} className="subtle-button" aria-pressed={using?.id === s.id} onClick={() => player.current?.use(s.id)}><kbd>{s.key}</kbd> {s.title}</button>)}
        <button className="subtle-button" aria-pressed={mode.kind === 'seated'} onClick={() => player.current?.sit()}><kbd>{SEAT.key}</kbd> {SEAT.title}</button>
        <button className="text-button" onClick={onFlat}>Use flat console</button>
        <button className="text-button" onClick={onExit}>Back to setup</button>
      </div>
    </div>
    <div ref={mount} className="cabin-view">
      {mode.kind === 'walk' && target && <button type="button" className="cabin-overlay cabin-prompt" onClick={() => player.current?.interact()}><kbd>E</kbd> {target.kind === 'seat' ? 'Sit in the pilot seat' : `Use ${target.title}`}</button>}
      {using && !compact && <button type="button" className="cabin-overlay cabin-prompt" onClick={() => player.current?.walk()}><kbd>Esc</kbd> Step back from {using.title}</button>}
      {using && compact && <div className="cabin-overlay cabin-sheet monitor-screen" data-station={using.id} role="group" aria-label={`${using.title} monitor`}>
        {screens[using.id]}
        <button type="button" className="launch-stand" onClick={() => player.current?.walk()}>Done</button>
      </div>}
      {mode.kind === 'seated' && <LaunchMenu checks={checks} reducedMotion={reducedMotion} onLaunch={() => { snap.current?.(); onLaunch(); }} onStand={() => player.current?.walk()} />}
    </div>
    {compact ? mode.kind === 'walk' && <p className="cabin-hint">Tap a station above, drag to look around, and sit in the pilot seat to start. The ship is illustrative; the view outside does not show your landing site. Imagery: NASA.</p> : <p className="cabin-hint">Walk with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>, turn the camera with <kbd>←</kbd> <kbd>→</kbd> or by dragging, use what is in front of you with <kbd>E</kbd>. Sit in the pilot seat to start the mission. The ship is illustrative, and the view outside does not show your landing site. Moon, Mars and Earth imagery: NASA.</p>}
    {!compact && STATIONS.map(s => createPortal(screens[s.id], pages[s.id], s.id))}
  </section>;
}
