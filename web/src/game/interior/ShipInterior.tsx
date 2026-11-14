import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import type { ControlCenterProps } from '../contracts';
import SystemsConsole from '../SystemsConsole';
import { buildAstronaut } from './astronaut';
import { buildCabin } from './cabin';
import { buildChecklist } from './checklist';
import { buildSpace } from './exterior';
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
  const [flat, setFlat] = useState(() => window.innerWidth < 760);
  const [failure, setFailure] = useState('');
  if (flat || failure) return <div className="ship-interior-flat">
    <p className="field-help" role="status">{failure ? `The 3D bridge could not start (${failure}). Showing the flat console.` : 'Flat console view.'}{' '}
      {!failure && <button className="text-button" onClick={() => setFlat(false)}>Enter the bridge</button>}</p>
    <SystemsConsole {...props} />
  </div>;
  return <Bridge {...props} onFlat={() => setFlat(true)} onFailure={setFailure} />;
}

function Bridge({ mission, settings, onSettingsChange, onLaunch, onExit, error, weatherAvailable, weather, reducedMotion, onFlat, onFailure }:
  ControlCenterProps & { onFlat: () => void; onFailure: (reason: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<ThirdPerson | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'walk' });
  const [target, setTarget] = useState<Target | null>(null);
  // one page element per monitor; React renders into them, the scene places them
  const pages = useMemo(() => Object.fromEntries(STATIONS.map(s => {
    const el = document.createElement('div');
    el.className = `monitor-screen monitor-${s.id}`; el.dataset.station = s.id;
    el.style.width = `${PAGE.width}px`; el.style.height = `${PAGE.height}px`;
    el.style.setProperty('--accent', `#${s.accent.toString(16).padStart(6, '0')}`);
    el.setAttribute('role', 'group'); el.setAttribute('aria-label', `${s.title} monitor`);
    return [s.id, el];
  })) as Record<StationId, HTMLDivElement>, []);
  const body = mission.planetaryTarget.body;
  const fail = useRef(onFailure); fail.current = onFailure;
  const motion = useRef(reducedMotion); motion.current = reducedMotion;

  useEffect(() => {
    const host = mount.current!;
    let webgl: THREE.WebGLRenderer;
    try { webgl = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { fail.current(e instanceof Error ? e.message : 'WebGL is not available'); return; }
    webgl.setPixelRatio(Math.min(devicePixelRatio, 2));
    webgl.setClearColor(0x000000, 0);
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
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 4000);
    const cabin = buildCabin(), space = buildSpace(body), astronaut = buildAstronaut();
    scene.add(cabin.group, space.group, astronaut.group);
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.5); sun.position.copy(space.sunDirection).multiplyScalar(60);
    scene.add(sun, new THREE.HemisphereLight(0xcfe0ff, 0x2a2f3a, 1.25));
    for (const [x, z] of [[-3, -1.2], [3, -1.2], [0, 2.2]] as const) { const l = new THREE.PointLight(0xdfeaff, 10, 11, 1.3); l.position.set(x, ROOM.heightM - 0.4, z); scene.add(l); }

    const holeGeo = new THREE.PlaneGeometry(SCREEN.widthM, SCREEN.heightM);
    // writes "fully transparent" into the picture wherever a screen is the nearest thing
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, transparent: true, blending: THREE.NoBlending });
    const mounted: THREE.Object3D[] = [];
    for (const station of STATIONS) {
      const { position, rotationY } = cabin.mounts[station.id];
      const page = new CSS3DObject(pages[station.id]);
      page.position.copy(position); page.rotation.y = rotationY; page.scale.setScalar(SCREEN.widthM / PAGE.width);
      const hole = new THREE.Mesh(holeGeo, holeMat); hole.position.copy(position); hole.rotation.y = rotationY;
      const glow = new THREE.PointLight(station.accent, 3.5, 5, 1.6); glow.position.set(position.x + station.nx * 1.1, SCREEN.centreHeightM, position.z + station.nz * 1.1);
      scene.add(page, hole, glow); mounted.push(page, hole, glow);
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

    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      tp.setReducedMotion(motion.current);
      tp.update(dt);
      const seated = tp.mode.kind === 'seated';
      astronaut.group.position.set(tp.pos.x, seated ? SEAT.seatHeightM - 0.2 : 0, tp.pos.z + (seated ? 0.02 : 0));
      astronaut.group.rotation.y = -tp.heading;
      astronaut.animate(dt, tp.speed, seated);
      if (!motion.current) space.drift(dt);
      camera.position.set(tp.camera.x, tp.camera.y, tp.camera.z);
      camera.lookAt(tp.camera.tx, tp.camera.ty, tp.camera.tz);
      webgl.render(scene, camera); css.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); host.removeEventListener('scroll', unscroll); tp.dispose(); player.current = null;
      for (const s of STATIONS) pages[s.id].removeEventListener('focusin', focusIn);
      for (const o of mounted) scene.remove(o);
      holeGeo.dispose(); holeMat.dispose(); cabin.dispose(); space.dispose(); astronaut.dispose();
      webgl.dispose(); webgl.forceContextLoss();
      webgl.domElement.remove(); css.domElement.remove();
    };
  }, [body, pages]);

  const checks = buildChecklist({ mission, settings, weatherAvailable, weatherLoaded: !!weather, error });
  const using = mode.kind === 'station' ? STATIONS.find(s => s.id === mode.id)! : null;
  return <section className="ship-interior" aria-label="Ship's bridge">
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
      {mode.kind === 'walk' && target && <div className="cabin-overlay cabin-prompt" role="status"><kbd>E</kbd> {target.kind === 'seat' ? 'Sit in the pilot seat' : `Use ${target.title}`}</div>}
      {using && <div className="cabin-overlay cabin-prompt" role="status"><kbd>Esc</kbd> Step back from {using.title}</div>}
      {mode.kind === 'seated' && <LaunchMenu checks={checks} reducedMotion={reducedMotion} onLaunch={onLaunch} onStand={() => player.current?.walk()} />}
    </div>
    <p className="cabin-hint">Walk with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>, turn the camera with <kbd>←</kbd> <kbd>→</kbd> or by dragging, use what is in front of you with <kbd>E</kbd>. Sit in the pilot seat to start the mission. The ship and the view outside are illustrative.</p>
    {createPortal(<MissionControlScreen mission={mission} settings={settings} checks={checks} />, pages.mission)}
    {createPortal(<EquipmentScreen mission={mission} settings={settings} onSettingsChange={onSettingsChange} />, pages.equipment)}
    {createPortal(<FlightConfigScreen mission={mission} settings={settings} onSettingsChange={onSettingsChange} weatherAvailable={weatherAvailable} weather={weather} />, pages.config)}
  </section>;
}
