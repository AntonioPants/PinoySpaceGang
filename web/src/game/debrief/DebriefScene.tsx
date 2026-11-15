/**
 * The in-character debrief. After the landing the astronaut walks across the bridge to the
 * mission-control monitor, the camera pushes into its screen, and the landing report opens on
 * that screen as a carousel: one section at a time, with a burst of TV static between sections.
 *
 * The 3D walk is presentation only. The report shows the flown telemetry and never changes it.
 * With reduced motion, or when 3D cannot start, the report opens on the screen straight away.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FlightTelemetry } from '../../../../app/sim/src/types';
import type { CatalogSite } from '../../../../app/sim/src/catalog';
import type { MissionConfig, TerrainProfile } from '../../lib/types';
import { computeFidelity } from '../../lib/fidelity';
import type { MatchCheck } from '../../lib/matching';
import { buildAstronaut } from '../interior/astronaut';
import { buildCabin } from '../interior/cabin';
import { buildSpace } from '../interior/exterior';
import { followCamera, headingOf, standSpot, stationCamera, type CameraPose } from '../interior/player';
import { ROOM, SCREEN, STATIONS } from '../interior/stations';
import { buildSections, stepIndex, type FidelityState } from './sections';
import '../interior/interior.css';
import './debrief.css';

type Stage = 'walk' | 'screen';
const WALK_S = 3.6, SETTLE_S = 1.3, ZOOM_S = 1.7;
/** How long the static covers the screen when the section changes, ms. The content swaps halfway. */
const STATIC_MS = 420;
const REPORT_STATION = STATIONS.find(s => s.id === 'mission')!;
const START = { x: 1.1, z: -0.4 };

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const mix = (a: CameraPose, b: CameraPose, t: number): CameraPose =>
  ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, tx: a.tx + (b.tx - a.tx) * t, ty: a.ty + (b.ty - a.ty) * t, tz: a.tz + (b.tz - a.tz) * t });

/** What the monitor shows while the astronaut walks over: the same dark glass as the report page. */
function screenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 840; canvas.height = 490;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#0a0c0f'; g.fillRect(0, 0, 840, 490);
  g.fillStyle = '#f2f4f6'; g.font = '500 44px "Inter Variable", sans-serif'; g.fillText('Flight report', 44, 86);
  g.fillStyle = '#343a42'; g.fillRect(44, 112, 752, 2);
  g.fillStyle = '#5fc48a'; g.font = '600 26px "Inter Variable", sans-serif'; g.fillText('Telemetry received', 44, 170);
  g.fillStyle = '#23282e'; for (let i = 0; i < 5; i++) g.fillRect(44, 210 + i * 46, 752 - (i % 3) * 150, 18);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Draws TV static into a small canvas for as long as `active` is true. */
function StaticNoise({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, g = canvas?.getContext('2d');
    if (!active || !canvas || !g) return;
    const { width: w, height: h } = canvas, image = g.createImageData(w, h), pixels = new Uint32Array(image.data.buffer);
    let raf = 0;
    const draw = () => {
      // A torn band of brighter snow rolls down the picture, like a set losing vertical hold.
      const band = Math.floor(Math.random() * h), bandHeight = 6 + Math.floor(Math.random() * 14);
      for (let y = 0, i = 0; y < h; y++) {
        const torn = y >= band && y < band + bandHeight, dark = y % 3 === 0 ? 0.72 : 1;
        for (let x = 0; x < w; x++, i++) {
          const v = Math.floor((torn ? 150 + Math.random() * 105 : Math.random() * 235) * dark);
          pixels[i] = 0xff000000 | (v << 16) | (v << 8) | v;
        }
      }
      g.putImageData(image, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return <canvas ref={ref} className={`deb-static${active ? ' on' : ''}`} width={320} height={180} aria-hidden="true" />;
}

export default function DebriefScene({ flight, mission, profile, analogEntry, planetaryEntry, match, reducedMotion, onRetry }: {
  flight: FlightTelemetry; mission: MissionConfig; profile: TerrainProfile; match?: MatchCheck;
  analogEntry?: CatalogSite; planetaryEntry?: CatalogSite; reducedMotion: boolean; onRetry: () => void;
}) {
  const [stage, setStage] = useState<Stage>(reducedMotion ? 'screen' : 'walk');
  const [index, setIndex] = useState(0), [noise, setNoise] = useState(false);
  const [fidelity, setFidelity] = useState<FidelityState>({ status: 'working' });
  const mount = useRef<HTMLDivElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const swap = useRef(0);
  const body = mission.planetaryTarget.body;

  // The rehearsal flights start at once, so they are usually finished by the time the report opens.
  useEffect(() => {
    const abort = new AbortController(); setFidelity({ status: 'working' });
    computeFidelity(mission, profile, analogEntry, planetaryEntry, abort.signal)
      .then(result => { if (!abort.signal.aborted) setFidelity({ status: 'done', result }); })
      .catch(e => { if (!abort.signal.aborted) setFidelity({ status: 'unavailable', reason: e instanceof Error ? e.message : 'Could not compute the score.' }); });
    return () => abort.abort();
  }, [mission, profile, analogEntry, planetaryEntry]);

  const sections = useMemo(() => buildSections({ flight, mission, profile, match, fidelity }), [flight, mission, profile, match, fidelity]);

  const openScreen = useCallback(() => {
    setStage(current => {
      if (current === 'screen') return current;
      if (!reducedMotion) { setNoise(true); window.setTimeout(() => setNoise(false), STATIC_MS); }   // the report tunes in
      return 'screen';
    });
  }, [reducedMotion]);

  // ---- the walk to the monitor and the push into its screen
  useEffect(() => {
    if (stage !== 'walk') return;
    const host = mount.current!;
    let webgl: THREE.WebGLRenderer;
    try { webgl = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 1.5, powerPreference: 'high-performance' }); }
    catch { openScreen(); return; }
    webgl.setPixelRatio(Math.min(devicePixelRatio, 2));
    webgl.toneMapping = THREE.ACESFilmicToneMapping; webgl.toneMappingExposure = 1.05;
    webgl.shadowMap.enabled = true; webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    webgl.domElement.className = 'deb-canvas';
    host.append(webgl.domElement);

    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x02040b);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 4000);
    const cabin = buildCabin(), space = buildSpace(body), astronaut = buildAstronaut();
    scene.add(cabin.group, space.group, astronaut.group);
    const sun = new THREE.DirectionalLight(0xfff0dc, 4.2);
    sun.position.copy(space.sunDirection).multiplyScalar(32); sun.target.position.set(0, 1, 0);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera; sc.left = sc.bottom = -9; sc.right = sc.top = 9; sc.near = 0.05; sc.far = 70; sc.updateProjectionMatrix();
    const overhead = new THREE.DirectionalLight(0xfff6ec, 1.15);
    overhead.position.set(0, ROOM.heightM - 0.25, 0); overhead.target.position.set(0, 0, 0.001);
    scene.add(sun, sun.target, overhead, overhead.target, new THREE.HemisphereLight(0xf3efe8, 0x3a3b3d, 0.85));
    for (const sx of [-1, 1]) { const fill = new THREE.DirectionalLight(0xfff3e4, 0.55); fill.position.set(sx * 4, 5, 3 * sx); scene.add(fill); }

    // the report monitor glows; the other two are dark glass
    const glassGeo = new THREE.PlaneGeometry(SCREEN.widthM, SCREEN.heightM), texture = screenTexture();
    const lit = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0c0f, emissive: 0x1b2734, emissiveIntensity: 0.6, roughness: 0.25 });
    for (const station of STATIONS) {
      const { position, rotationY } = cabin.mounts[station.id];
      const glass = new THREE.Mesh(glassGeo, station.id === REPORT_STATION.id ? lit : dark);
      glass.position.copy(position); glass.rotation.y = rotationY; scene.add(glass);
    }

    const stand = standSpot(REPORT_STATION), walkHeading = headingOf(stand.x - START.x, stand.z - START.z);
    const reading = stationCamera(REPORT_STATION), screenAt = cabin.mounts[REPORT_STATION.id].position;
    let filled = reading;
    const resize = () => {
      const w = host.clientWidth, h = Math.max(1, host.clientHeight);
      webgl.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      // Distance at which the screen covers the whole view, whichever way the window is shaped.
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const distance = Math.min(SCREEN.heightM / 2 / half, SCREEN.widthM / 2 / (half * camera.aspect)) * 0.98;
      filled = { x: screenAt.x + REPORT_STATION.nx * distance, y: screenAt.y, z: screenAt.z + REPORT_STATION.nz * distance, tx: screenAt.x, ty: screenAt.y, tz: screenAt.z };
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();

    // The timeline runs on the clock, not on frames, so a slow GPU shows fewer frames of the same
    // few seconds instead of a long slow-motion walk.
    const began = performance.now();
    let raf = 0, last = began, finished = false;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000), t = (now - began) / 1000; last = now;
      const walked = ease(clamp01(t / WALK_S)), arrived = t >= WALK_S;
      const pos = { x: START.x + (stand.x - START.x) * walked, z: START.z + (stand.z - START.z) * walked };
      // turn to face the screen once there
      const turn = ease(clamp01((t - WALK_S) / 0.6));
      const facing = walkHeading + Math.atan2(Math.sin(stand.heading - walkHeading), Math.cos(stand.heading - walkHeading)) * turn;
      astronaut.group.position.set(pos.x, 0, pos.z); astronaut.group.rotation.y = -facing;
      astronaut.animate(dt, arrived ? 0 : Math.sin(Math.PI * clamp01(t / WALK_S)) * 0.9 + 0.1, false);
      space.drift(dt);
      const follow = followCamera(pos, walkHeading, 0.22);
      const settle = ease(clamp01((t - WALK_S * 0.72) / SETTLE_S));
      const zoom = ease(clamp01((t - WALK_S - SETTLE_S * 0.75) / ZOOM_S));
      const pose = mix(mix(follow, reading, settle), filled, zoom);
      camera.position.set(pose.x, pose.y, pose.z); camera.lookAt(pose.tx, pose.ty, pose.tz);
      astronaut.group.visible = zoom < 0.35;     // out of the way before the camera passes the standing spot
      webgl.render(scene, camera);
      if (zoom >= 1 && !finished) { finished = true; openScreen(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); observer.disconnect();
      glassGeo.dispose(); lit.dispose(); dark.dispose(); texture.dispose();
      cabin.dispose(); space.dispose(); astronaut.dispose();
      webgl.dispose(); webgl.forceContextLoss(); webgl.domElement.remove();
    };
  }, [stage, body, openScreen]);

  // ---- the carousel
  const go = useCallback((delta: number) => {
    if (sections.length < 2) return;
    if (reducedMotion) { setIndex(i => stepIndex(i, delta, sections.length)); return; }
    window.clearTimeout(swap.current);
    setNoise(true);
    // the section changes under the static, then the picture comes back
    swap.current = window.setTimeout(() => {
      setIndex(i => stepIndex(i, delta, sections.length));
      swap.current = window.setTimeout(() => setNoise(false), STATIC_MS / 2);
    }, STATIC_MS / 2);
  }, [reducedMotion, sections.length]);
  useEffect(() => () => window.clearTimeout(swap.current), []);
  useEffect(() => {
    if (stage !== 'screen') return;
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); } else if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
    };
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys);
  }, [stage, go]);
  useEffect(() => { if (stage === 'screen') heading.current?.focus({ preventScroll: true }); }, [stage]);

  const section = sections[Math.min(index, sections.length - 1)];
  if (stage === 'walk') return <section className="debrief-scene" aria-label="Debrief">
    <div ref={mount} className="deb-view" />
    <p className="deb-caption" role="status">The landing report is coming in on the mission-control monitor.</p>
    <button type="button" className="deb-skip" onClick={openScreen}>Skip to report</button>
  </section>;
  return <section className="debrief-scene" aria-label="Landing report">
    <div className={`deb-screen monitor-screen${noise ? ' tuning' : ''}`}>
      <header>
        <h2 ref={heading} tabIndex={-1}>Flight report</h2>
        <span className="mon-link"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />{mission.planetaryTarget.name} → {mission.earthAnalog.name}</span>
      </header>
      <div className="deb-page" role="group" aria-roledescription="slide" aria-label={`${section.title}, ${index + 1} of ${sections.length}`} aria-live="polite">
        <h3>{String(index + 1).padStart(2, '0')} <span>{section.title}</span></h3>
        <div className="deb-content" key={section.id}>{section.content}</div>
      </div>
      <footer>
        <div className="deb-dots" role="tablist" aria-label="Report sections">{sections.map((s, i) =>
          <button key={s.id} type="button" role="tab" aria-selected={i === index} aria-label={s.title} title={s.title} onClick={() => go(i - index)} />)}</div>
        <span className="deb-count">{index + 1} / {sections.length}</span>
        <button type="button" className="deb-retry" onClick={onRetry}>Configure another flight</button>
      </footer>
      <StaticNoise active={noise} />
      <div className="deb-scanlines" aria-hidden="true" />
    </div>
    <button type="button" className="deb-arrow left" aria-label="Previous section" onClick={() => go(-1)}><ChevronLeft size={34} /></button>
    <button type="button" className="deb-arrow right" aria-label="Next section" onClick={() => go(1)}><ChevronRight size={34} /></button>
  </section>;
}
