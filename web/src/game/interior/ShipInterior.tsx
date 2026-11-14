import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import type { ControlCenterProps } from '../contracts';
import SystemsConsole from '../SystemsConsole';
import { buildCabin, SCREEN, wallMount } from './cabin';
import { buildChecklist } from './checklist';
import { buildExterior } from './exterior';
import { FirstPerson } from './firstPerson';
import { CABIN, STATIONS, type StationId } from './stations';
import EquipmentScreen from './screens/EquipmentScreen';
import FlightConfigScreen from './screens/FlightConfigScreen';
import LaunchScreen from './screens/LaunchScreen';
import MissionControlScreen from './screens/MissionControlScreen';
import './interior.css';

/** Size of each monitor's page in CSS pixels; scaled to SCREEN metres in the scene. */
const PAGE = { width: 760, height: Math.round(760 * SCREEN.heightM / SCREEN.widthM) };

/**
 * The control centre: the inside of the lander, in first person. The player walks the cabin and
 * sets up the mission on four monitors. The monitors are real pages placed in the 3D scene, so
 * their buttons and menus work with mouse, keyboard and screen readers. The flat console stays
 * one click away, and is used automatically when 3D cannot start or the window is phone-sized.
 */
export default function ShipInterior(props: ControlCenterProps) {
  const [flat, setFlat] = useState(() => window.innerWidth < 760);
  const [failure, setFailure] = useState('');
  if (flat || failure) return <div className="ship-interior-flat">
    <p className="field-help" role="status">{failure ? `The 3D cabin could not start (${failure}). Showing the flat console.` : 'Flat console view.'}{' '}
      {!failure && <button className="text-button" onClick={() => setFlat(false)}>Enter the cabin</button>}</p>
    <SystemsConsole {...props} />
  </div>;
  return <Cabin {...props} onFlat={() => setFlat(true)} onFailure={setFailure} />;
}

function Cabin({ mission, settings, onSettingsChange, onLaunch, onExit, error, weatherAvailable, weather, reducedMotion, onFlat, onFailure }:
  ControlCenterProps & { onFlat: () => void; onFailure: (reason: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<FirstPerson | null>(null);
  // one page element per monitor; React renders into them, the scene places them
  const pages = useMemo(() => Object.fromEntries(STATIONS.map(s => {
    const el = document.createElement('div');
    el.className = 'monitor-screen'; el.dataset.station = s.id;
    el.style.width = `${PAGE.width}px`; el.style.height = `${PAGE.height}px`;
    el.setAttribute('role', 'group'); el.setAttribute('aria-label', `${s.title} monitor`);
    return [s.id, el];
  })) as Record<StationId, HTMLDivElement>, []);
  const body = mission.planetaryTarget.body;
  const fail = useRef(onFailure); fail.current = onFailure;

  useEffect(() => {
    const host = mount.current!;
    let webgl: THREE.WebGLRenderer;
    try { webgl = new THREE.WebGLRenderer({ antialias: true }); }
    catch (e) { fail.current(e instanceof Error ? e.message : 'WebGL is not available'); return; }
    webgl.setPixelRatio(Math.min(devicePixelRatio, 2));
    webgl.domElement.className = 'cabin-canvas';
    const css = new CSS3DRenderer();
    css.domElement.className = 'cabin-screens';
    host.append(webgl.domElement, css.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 2500);
    const cabin = buildCabin(), outside = buildExterior(body);
    scene.add(cabin.group, outside.group);
    scene.background = outside.sky; scene.fog = outside.fog;
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2); sun.position.copy(outside.sunDirection).multiplyScalar(50);
    const lamp = new THREE.PointLight(0xffe9c8, 14, 10, 1.4); lamp.position.set(0, CABIN.heightM - 0.3, 0);
    scene.add(sun, lamp, new THREE.HemisphereLight(0xdfe6ff, 0x3a3630, 1.5));

    const mounted: CSS3DObject[] = [];
    for (const station of STATIONS) {
      const page = new CSS3DObject(pages[station.id]);
      const { position, rotationY } = wallMount(station.angleDeg, 0.13);
      page.position.copy(position); page.rotation.y = rotationY; page.scale.setScalar(SCREEN.widthM / PAGE.width);
      scene.add(page); mounted.push(page);
    }

    const fp = new FirstPerson(host, {
      reducedMotion,
      onStation: id => pages[id].querySelector<HTMLElement>('button, select, input')?.focus({ preventScroll: true }),
    });
    player.current = fp;
    // tabbing into a monitor's controls walks the player to that monitor
    const focusIn = (e: FocusEvent) => { const id = (e.currentTarget as HTMLElement).dataset.station as StationId; fp.goTo(id); };
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
      fp.update(dt);
      camera.position.set(fp.pose.x, CABIN.eyeM, fp.pose.z);
      camera.rotation.set(fp.pose.pitch, -fp.pose.yaw, 0, 'YXZ');
      webgl.render(scene, camera); css.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); fp.dispose(); player.current = null;
      for (const s of STATIONS) pages[s.id].removeEventListener('focusin', focusIn);
      for (const page of mounted) scene.remove(page);
      cabin.dispose(); outside.dispose();
      webgl.dispose(); webgl.forceContextLoss();
      webgl.domElement.remove(); css.domElement.remove();
    };
    // the scene is built once per departure body; live values reach it through refs and portals
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, pages]);

  useEffect(() => { player.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);

  const checks = buildChecklist({ mission, settings, weatherAvailable, weatherLoaded: !!weather, error });
  return <section className="ship-interior" aria-label="Lander cabin">
    <div className="cabin-toolbar">
      <div><strong>Lander cabin</strong><small>On the surface of {body === 'Moon' ? 'the Moon' : 'Mars'} · {mission.planetaryTarget.name}</small></div>
      <div role="group" aria-label="Go to">
        {STATIONS.map(s => <button key={s.id} className="subtle-button" onClick={() => player.current?.goTo(s.id, true)}><kbd>{s.key}</kbd> {s.title}</button>)}
        <button className="subtle-button" onClick={() => player.current?.lookAtWindow()}><kbd>5</kbd> Window</button>
        <button className="text-button" onClick={onFlat}>Use flat console</button>
      </div>
    </div>
    <div ref={mount} className="cabin-view" />
    <p className="cabin-hint">Walk with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>, turn with <kbd>←</kbd> <kbd>→</kbd> or by dragging, step up to the nearest monitor with <kbd>E</kbd>. The cabin and the view outside are illustrative.</p>
    {createPortal(<MissionControlScreen mission={mission} settings={settings} checks={checks} />, pages.mission)}
    {createPortal(<EquipmentScreen settings={settings} onSettingsChange={onSettingsChange} equipment={mission.equipment} onEquipment={onExit} />, pages.equipment)}
    {createPortal(<FlightConfigScreen mission={mission} settings={settings} onSettingsChange={onSettingsChange} weatherAvailable={weatherAvailable} weather={weather} />, pages.config)}
    {createPortal(<LaunchScreen checks={checks} onLaunch={onLaunch} onExit={onExit} />, pages.launch)}
  </section>;
}
