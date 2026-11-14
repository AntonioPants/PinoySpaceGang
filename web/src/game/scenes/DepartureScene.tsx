import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CutsceneAudio } from '../../components/cutscene/audio';
import { clearHandoff, leaveHandoff, peekHandoff } from '../../components/cutscene/engine';
import type { SceneProps } from '../contracts';
import { buildSpace } from '../interior/exterior';
import { SceneFrame } from './SceneFrame';
import './departure.css';

const DURATION_S = 7, DISSOLVE_S = 0.9;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Leaving the Moon or Mars: the view swings from the world falling behind to the Earth ahead and
 * closes in on it. It uses the same illustrative space as the bridge window (NASA imagery, staged
 * sizes and distances). It flies no physics and shows neither the departure nor the landing site.
 */
export default function DepartureScene({ mission, reducedMotion, onComplete }: SceneProps) {
  const body = mission.planetaryTarget.body;
  return <SceneFrame title={`Leaving ${body === 'Moon' ? 'the Moon' : 'Mars'}`} reducedMotion={reducedMotion} onComplete={onComplete}
    detail={`The ship departs ${mission.planetaryTarget.name} for ${mission.earthAnalog.name} on Earth.`}>
    {muted => <Departure body={body} from={mission.planetaryTarget.name} to={mission.earthAnalog.name} muted={muted} onDone={onComplete} />}
  </SceneFrame>;
}

/**
 * The space shot itself. It dissolves from the last frame of the scene before it (or from black)
 * and leaves its own last frame for the next scene to dissolve from, so it sits between cutscenes
 * without a cut.
 */
export function Departure({ body, from, to, muted = false, onDone }: { body: 'Moon' | 'Mars'; from: string; to: string; muted?: boolean; onDone: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [still] = useState(peekHandoff);
  const done = useRef(onDone); done.current = onDone;
  const audio = useRef<CutsceneAudio | null>(null);
  useEffect(() => { audio.current?.setMuted(muted); }, [muted]);
  useEffect(() => {
    const el = host.current!;
    const sound = new CutsceneAudio(); sound.muted = muted; sound.start(); audio.current = sound;
    sound.setThrust(0.16); sound.whoosh(3.2, 0.35);              // the cruise engine, and the swing round to Earth
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 1.5, powerPreference: 'high-performance' }); }
    catch { sound.stop(); done.current(); return; }       // no 3D: carry on with the mission
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x02040b);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 4000);
    const space = buildSpace(body); scene.add(space.group);
    // the two things to look at, as placed by buildSpace
    const home = new THREE.Vector3(-520, -330, -820), earth = new THREE.Vector3(-60, 205, -1150);
    const look = new THREE.Vector3();
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf = 0, finished = false; const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / 1000 / DURATION_S), turn = ease(Math.min(1, t / 0.6)), close = ease(Math.max(0, (t - 0.35) / 0.65));
      look.copy(home).lerp(earth, turn);
      camera.position.copy(earth).multiplyScalar(close * 0.62);     // run toward Earth
      camera.fov = 58 - close * 24; camera.updateProjectionMatrix();
      camera.lookAt(look);
      space.drift(1 / 60);
      renderer.render(scene, camera);
      if (t > DISSOLVE_S / DURATION_S) clearHandoff();
      if (t >= 1) { if (!finished) { finished = true; leaveHandoff(renderer.domElement); done.current(); } return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { sound.stop(); audio.current = null; cancelAnimationFrame(raf); ro.disconnect(); space.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);
  return <div ref={host} className="departure-scene">
    <div className="departure-caption"><strong>Leaving {body === 'Moon' ? 'the Moon' : 'Mars'}</strong><span>{from} → {to}, Earth</span></div>
    <small className="departure-note">Illustrative view. Moon, Mars and Earth imagery: NASA.</small>
    <div className="departure-cover" style={{ animationDuration: `${DISSOLVE_S}s`, backgroundImage: still ? `url("${still}")` : undefined }} />
  </div>;
}
