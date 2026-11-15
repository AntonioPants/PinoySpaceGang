import * as THREE from "three";
import { CutsceneAudio } from "./audio";
import { buildLander, type Lander, type LanderSpec } from "./lander";
import { Particles } from "./particles";
import { buildLaunchPad, buildRocket, PAYLOAD_Y, type Nozzle, type Rocket } from "./rocket";
import { DEFAULT_START, type FlightLike, type FlightOutcome } from "./flight";
import { PRESETS, type CutsceneEnv, type EndingParams, type EnvLook } from "./presets";
import { buildTerrain, type Boulder, type Terrain } from "./terrain";
import type { TerrainPack } from "./terrainPack";

/** "ending" replays `params.flight`; "success" and "crash" are stand-ins for when there is no flight yet. */
/** "liftoff" is the departure: ignition, dust blast, climb, in the gravity and air of the env's preset. */
export type CutsceneKind = "opening" | "liftoff" | "ending" | "success" | "crash";
import type { EarthScenery } from "../../lib/earthTileScenery";
export interface EngineOptions {
  muted?: boolean; showSkip?: boolean;
  letterbox?: boolean;                   // cinema bars top and bottom (default true)
  boulders?: Boulder[];                  // extra rocks to draw (scene metres), e.g. synthetic test hazards
  equipment?: LanderSpec;                // which lander hardware to draw; omit for the generic lander
  terrain?: TerrainPack;                 // real terrain; omit for the procedural landscape
  landing?: { x: number; z: number };    // pad position in pack metres; default: flat spot picked from the data
}

const DURATION_OPENING = 13;
const DURATION_LIFTOFF = 9;
// Opening timeline (s): the rocket brakes, drops its boosters, opens its fairing and lets the
// lander go; the lander unfolds its legs and arrays and lights its engine before the hand-over.
const OP = { entry: 3.2, boosters: 4.0, fairing: 5.2, fairingFree: 5.9, release: 6.4, gear: 7.0, arrays: 7.6 };
// Liftoff: ignition, release from the pad, climb (m/s^2)
const LO = { ignite: 1.4, rise: 2.2, climb: 6.5 };
const TAIL: Record<FlightOutcome, number> = { success: 6.5, "hard-landing": 6.5, "tip-over": 6, crash: 7, timeout: 3 };
// Scene changes dissolve instead of cutting: a scene that ends leaves its last frame here, and the
// next scene (cutscene, departure shot or live descent) starts under that still and fades it out.
let rendererSequence=0;
let handoff: { url: string; at: number } | null = null;
/** Keeps `canvas`'s current frame for the next scene. Call it right after rendering that frame. */
export function leaveHandoff(canvas: HTMLCanvasElement) {
  try { handoff = { url: canvas.toDataURL("image/jpeg", 0.9), at: performance.now() }; } catch { handoff = null; }
}
/** The previous scene's last frame, if it ended moments ago. */
export function peekHandoff(): string | null {
  return handoff && performance.now() - handoff.at < 15000 ? handoff.url : null;
}
/** The still has been dissolved: the next scene change starts fresh. */
export function clearHandoff() { handoff = null; }
const DISSOLVE = 0.9;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t: number) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

interface Track {
  t: number[]; pos: THREE.Vector3[]; throttle: number[]; tilt: number[]; lean: THREE.Vector3[];
  duration: number; outcome: FlightOutcome; impact: number; sink: number; survivability: number;
  reason?: string; push: THREE.Vector3; endTilt: number; endLean: THREE.Vector3;
}

function sampleTrack(tr: Track, time: number) {
  const n = tr.t.length;
  let i = 0; while (i < n - 2 && tr.t[i + 1] < time) i++;
  const u = clamp01((time - tr.t[i]) / Math.max(1e-6, tr.t[i + 1] - tr.t[i]));
  return { pos: tr.pos[i].clone().lerp(tr.pos[i + 1], u), throttle: lerp(tr.throttle[i], tr.throttle[i + 1], u),
    tilt: lerp(tr.tilt[i], tr.tilt[i + 1], u), lean: tr.lean[i] };
}

/** Stand-in flights for the "success" and "crash" kinds, used until real telemetry exists. */
function standInFlight(kind: "success" | "crash", p: EndingParams): FlightLike {
  const samples = [], crash = kind === "crash", T = crash ? 3 : 2.6;
  const vy = crash ? Math.abs(p.vy ?? 14) : Math.abs(p.vy ?? 1), vx = crash ? Math.abs(p.vx ?? 6) : 0;
  for (let i = 0; i <= T * 10; i++) {
    const t = i / 10, left = T - t;
    const alt = crash ? vy * left : 17 * Math.pow(left / T, 3);
    samples.push({ t, x: -vx * left, y: 0, z: alt, vx, vy: 0, vz: -vy, altitudeAGL: alt, tiltDeg: crash ? Math.abs(p.tiltDeg ?? 24) : 0, throttle: crash ? 0.35 : lerp(0.75, 0.5, t / T) });
  }
  return { samples, summary: { outcome: crash ? "crash" : "success", survivability: crash ? 0 : 100, failureReasons: p.reason ? [p.reason] : [],
    flightTimeS: T, verticalSpeedMps: vy, horizontalSpeedMps: vx, slopeDeg: 0, tiltDeg: 0, landingPoint: { x: 0, y: 0, z: 0 } } };
}

interface Debris { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; resting: boolean; }
/** A separated rocket part flying on its own: velocity, acceleration, and spin (axis × rad/s). */
interface FreePart { obj: THREE.Object3D; vel: THREE.Vector3; acc: THREE.Vector3; spin: THREE.Vector3; }
interface Ring { mesh: THREE.Mesh; age: number; life: number; from: number; to: number; billboard: boolean; }

/** Framework-free cutscene player. One instance per container; call play() as often as needed. */
export class CutsceneEngine {
  readonly audio = new CutsceneAudio();
  protected renderer: THREE.WebGLRenderer;
  protected scene = new THREE.Scene();
  protected camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 9000);
  protected look: EnvLook;
  protected terrain: Terrain;
  protected lander: Lander;
  protected rocket: Rocket;               // carries the lander in the liftoff and the opening
  protected pad: THREE.Group;
  protected free: FreePart[] = [];
  protected prevRocket = V(); protected rocketVel = V();
  protected fire = new Particles(4000, true);
  protected smoke = new Particles(3500, false);
  protected engineLight = new THREE.PointLight(0xffb060, 0, 120, 1.6);
  protected flashLight = new THREE.PointLight(0xffa040, 0, 700, 1.4);
  protected shadow: THREE.Mesh;
  protected scorch: THREE.Mesh;
  protected fireball: THREE.Mesh;
  protected debris: Debris[] = [];
  protected rings: Ring[] = [];
  protected camPos = V(); protected camLook = V();
  protected prevPos = V(); protected landerVel = V();
  protected track: Track | null = null;
  protected cam0 = { ang: 0.88, r: 30 };
  protected downhill = V(1, 0, 0);
  protected gravity = 9.81;
  protected air = 1.2;                    // simulated air density, kg/m^3: shapes the plume and the dust
  protected wind = V();                   // scene m/s, pushes dust and smoke
  protected dustLevel = 1;                // multiplier on plume-raised dust
  protected tdPoint = V();                // touchdown point the ending is staged around
  protected camEase = 0;                  // 0 = camera cuts; > 0 = follow rate (1/s)
  protected frameDt = 1 / 60;
  protected shakeClock = 0;
  protected camVel = V(); protected lookVel = V();
  protected sunDir = V(-0.55, 0.42, -0.72).normalize();
  protected skipButton = true;
  protected duration = DURATION_OPENING;
  protected targetRing: THREE.Mesh;
  protected sky: THREE.Group;
  protected trauma = 0;
  protected acc = { exhaust: 0, dust: 0, wreckFire: 0, wreckSmoke: 0, trail: 0 };
  protected flags: Record<string, boolean> = {};
  protected kind: CutsceneKind | "live" | null = null;
  protected params: EndingParams = {};
  protected t = 0; protected last = 0; protected raf = 0;
  protected finish: (() => void) | null = null;
  protected ro: ResizeObserver;
  protected ui: { root: HTMLDivElement; title: HTMLDivElement; sub: HTMLDivElement; cap: HTMLDivElement; flash: HTMLDivElement; fade: HTMLDivElement; skip: HTMLButtonElement; cover: HTMLDivElement };
  protected coverAge = -1;                // < 0: the cover (previous scene's still, or black) has gone
  protected disposed = false;

  constructor(protected container: HTMLElement, protected env: CutsceneEnv, opts: EngineOptions = {}) {
    this.look = { ...PRESETS[env.preset ?? "desert"], ...env.look };
    this.audio.muted = !!opts.muted;
    // On dense screens multisampling is the largest single cost on integrated GPUs and adds little.
    const dense = (window.devicePixelRatio || 1) >= 1.5;
    this.renderer = new THREE.WebGLRenderer({ antialias: !dense, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
    if (getComputedStyle(container).position === "static") container.style.position = "relative";
    this.renderer.domElement.dataset.rendererId=String(++rendererSequence);
    container.appendChild(this.renderer.domElement);

    // sky, sun, light
    this.scene.fog = new THREE.Fog(this.look.fog, 120, this.look.fogFar);
    this.sky = this.buildSky(); this.scene.add(this.sky);
    const sunDir = this.sunDir;
    this.scene.add(new THREE.HemisphereLight(this.look.stars ? 0x222230 : this.look.skyHorizon, this.look.groundDark, this.look.stars ? 0.25 : 0.95));
    const sun = new THREE.DirectionalLight(this.look.sun, 2.4); sun.position.copy(sunDir).multiplyScalar(100); this.scene.add(sun);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture(), color: this.look.sun, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.copy(sunDir).multiplyScalar(5000); glow.scale.setScalar(1700); this.scene.add(glow);

    this.terrain = buildTerrain(this.look, opts.terrain ? undefined : env.elevation, env.seed ?? 7, opts.terrain, opts.landing, opts.boulders);
    this.scene.add(this.terrain.group);
    this.lander = buildLander(opts.equipment);
    this.rocket = buildRocket(opts.equipment); this.rocket.group.visible = false;
    // the pad's service tower stands behind the rocket and to one side, as seen from the liftoff camera
    this.pad = buildLaunchPad(Math.atan2(this.sunDir.z, this.sunDir.x) + 0.55 + Math.PI - 0.9); this.pad.visible = false;
    this.smoke.points.renderOrder = 2; this.fire.points.renderOrder = 3;
    this.scene.add(this.lander.group, this.rocket.group, this.pad, this.fire.points, this.smoke.points, this.engineLight, this.flashLight);

    const disc = (r: number, color: number, opacity: number) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 1; this.scene.add(m); return m;
    };
    this.shadow = disc(3.6, 0x000000, 0.4);
    (this.shadow.material as THREE.MeshBasicMaterial).alphaMap = this.glowTexture(true);
    this.scorch = disc(15, 0x0a0806, 0.9); this.scorch.visible = false;
    (this.scorch.material as THREE.MeshBasicMaterial).alphaMap = this.glowTexture(true);
    this.fireball = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc26a, fog: false }));
    this.fireball.visible = false; this.scene.add(this.fireball);
    this.targetRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0x66ffaa, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, depthTest: false, fog: false }));
    this.targetRing.rotation.x = -Math.PI / 2; this.targetRing.visible = false; this.targetRing.renderOrder = 4; this.scene.add(this.targetRing);

    this.ui = this.buildOverlay(opts.showSkip !== false, opts.letterbox !== false);
    if (opts.terrain) {                                   // the data licence requires the credit to be shown
      const m = opts.terrain.manifest, c = document.createElement("div");
      c.className = 'terrain-credit';
      c.style.cssText = "position:absolute;left:2%;right:2%;bottom:1.4%;text-align:center;font-size:clamp(7px,.85vw,11px);opacity:.6;letter-spacing:.03em;line-height:1.2";
      c.textContent = `Terrain: ${m.name}. ${[m.source?.dataset, m.attribution].filter(Boolean).join(': ')}`;
      this.ui.root.appendChild(c);
    }
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.resetScene(); this.setCam(V(30, 6, 40), V(0, 3, 0)); this.render();
    // Compile every material now, so the first frame that shows the lander, its flame or the
    // fireball does not stall on shader compilation (a visible freeze on integrated GPUs).
    const hidden = [this.lander.group, this.lander.flame, this.rocket.group, this.rocket.coreNozzle.flame, ...this.rocket.boosterNozzles.map((n) => n.flame),
      this.pad, this.fireball, this.scorch, this.targetRing].filter((o) => !o.visible);
    hidden.forEach((o) => { o.visible = true; }); this.renderer.compile(this.scene, this.camera); hidden.forEach((o) => { o.visible = false; });
    // Until it runs, the scene sits under a cover: the last frame of the scene before it, or black.
    const still = peekHandoff();
    if (still) this.ui.cover.style.backgroundImage = `url("${still}")`;
    this.coverAge = 0;
  }

  /** Plays a cutscene. Resolves when it ends or is skipped. Endings keep animating until the next play()/dispose(). */
  play(kind: CutsceneKind, params: EndingParams = {}): Promise<void> {
    this.finish?.();
    this.audio.start();this.beginHandoff();
    this.begin(kind, params); this.last = performance.now();
    this.ui.skip.style.display = "block";
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
    return new Promise<void>((resolve) => {
      this.finish = () => { this.finish = null; this.ui.skip.style.display = "none"; if (kind === "opening" || kind === "liftoff") this.audio.setThrust(0); resolve(); };
    });
  }

  skip() { this.finish?.(); }

  protected begin(kind: CutsceneKind, params: EndingParams) {
    this.resetScene(); this.kind = kind; this.params = params; this.t = 0; this.prevPos.set(0, 0, 0);
    this.track = null; this.duration = DURATION_OPENING; this.dustLevel = 1;
    if (kind === "opening") return;
    if (kind === "liftoff") {
      // the site's own gravity and air: a vacuum plume and a ballistic dust sheet on the Moon
      this.duration = DURATION_LIFTOFF;
      this.gravity = this.env.preset === "lunar" ? 1.62 : this.env.preset === "mars" ? 3.71 : 9.81;
      this.air = this.env.preset === "lunar" ? 0 : this.env.preset === "mars" ? 0.02 : 1.2;
      this.dustLevel = 0.75;
      this.pad.position.set(0, this.terrain.heightAt(0, 0), 0);
      // no rock on the pad or between the camera and the rocket
      const path: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) path.push(this.liftoffCam(i / 24 * DURATION_LIFTOFF));
      this.clearRocks(path, 7); this.clearRocks([V()], 22);
      return;
    }
    const flight = kind === "ending" && params.flight?.summary && params.flight.samples.length > 1
      ? params.flight : standInFlight(kind === "crash" ? "crash" : "success", params);
    this.track = this.buildTrack(flight);
    this.duration = this.track.duration + TAIL[this.track.outcome];
    this.gravity = flight.environment?.gravity ?? 9.81;
  }

  /** Sets where the ending plays and which way is downhill there (for a tip-over). */
  protected stageEnding(at: THREE.Vector3, push: THREE.Vector3) {
    this.tdPoint.copy(at);
    const h = (dx: number, dz: number) => this.terrain.heightAt(at.x + dx, at.z + dz);
    const g = V(h(2, 0) - h(-2, 0), 0, h(0, 2) - h(0, -2));
    this.downhill = g.length() > 0.02 ? g.multiplyScalar(-1).normalize() : (push.length() > 0.2 ? push.clone().normalize() : V(1, 0, 0));
  }

  /** Last seconds of a flight in scene coordinates, with the touchdown point at the origin. */
  protected buildTrack(f: FlightLike): Track {
    const sum = f.summary!, lp = sum.landingPoint, end = sum.flightTimeS;
    const window = sum.outcome === "crash" ? 4.5 : 7;
    const src = f.samples.filter((s) => s.t >= end - window && s.t <= end);
    const tr: Track = { t: [], pos: [], throttle: [], tilt: [], lean: [], duration: 0, outcome: sum.outcome,
      impact: Math.hypot(sum.verticalSpeedMps, sum.horizontalSpeedMps), sink: sum.verticalSpeedMps, survivability: sum.survivability,
      reason: sum.failureReasons[0], push: V(), endTilt: THREE.MathUtils.degToRad(sum.tiltDeg), endLean: V(1, 0, 0) };
    const t0 = src.length ? src[0].t : end;
    let lean = V(1, 0, 0);
    src.forEach((s, i) => {
      const x = s.x - lp.x, z = -(s.y - lp.y);
      const nx = src[i + 1];
      if (nx && nx.t > s.t) {                               // the body leans the way the thrust pushes it
        const a = V((nx.vx - s.vx) / (nx.t - s.t), 0, -(nx.vy - s.vy) / (nx.t - s.t));
        if (a.length() > 0.05) lean = a.normalize();
        else if (Math.hypot(s.vx, s.vy) > 0.3) lean = V(-s.vx, 0, s.vy).normalize();
      }
      tr.t.push(s.t - t0); tr.pos.push(V(x, this.terrain.heightAt(x, z) + Math.max(0, s.altitudeAGL), z));
      tr.throttle.push(s.throttle); tr.tilt.push(THREE.MathUtils.degToRad(s.tiltDeg)); tr.lean.push(lean.clone());
    });
    const last = src[src.length - 1];
    if (!last || end - last.t > 1e-3 || last.altitudeAGL > 0.01) {      // close the path on the touchdown point
      tr.t.push(end - t0 + (last ? 0 : 0.01)); tr.pos.push(V(0, this.terrain.heightAt(0, 0), 0));
      tr.throttle.push(last?.throttle ?? 0); tr.tilt.push(tr.endTilt); tr.lean.push(lean.clone());
    }
    if (tr.t.length < 2) { tr.t.unshift(-0.01); tr.pos.unshift(tr.pos[0].clone()); tr.throttle.unshift(0); tr.tilt.unshift(0); tr.lean.unshift(lean.clone()); }
    tr.duration = tr.t[tr.t.length - 1]; tr.endLean = lean.clone();
    const before = src.length > 1 ? src[src.length - 2] : last;
    if (before) tr.push.set(before.vx, 0, -before.vy);
    // camera: off to the side of the approach path
    const first = tr.pos[0], along = V(-first.x, 0, -first.z);
    const side = along.length() > 3 ? Math.atan2(along.z, along.x) + Math.PI / 2 + 0.35 : 0.88;
    this.cam0 = { ang: side, r: sum.outcome === "crash" ? 36 : 30 };
    this.stageEnding(V(0, this.terrain.heightAt(0, 0), 0), tr.push);
    return tr;
  }
  setMuted(m: boolean) { this.audio.setMuted(m); }

  private scenery?: EarthScenery;
  attachEarthScenery(create: (renderer: THREE.WebGLRenderer, ground: THREE.BufferGeometry, meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[], look: EnvLook) => EarthScenery) {
    if (this.disposed || !this.terrain.measuredGround) return;
    this.scenery = create(this.renderer, this.terrain.measuredGround, this.terrain.measuredMeshes!, this.look);
    this.camera.far = 120000;
    this.camera.updateProjectionMatrix();
  }

  /** A warmed renderer was created before the preceding scene produced its final frame. */
  protected beginHandoff(){
    const still=peekHandoff();
    this.ui.cover.style.backgroundImage=still?`url("${still}")`:'';
    this.ui.cover.style.display='block';this.ui.cover.style.opacity='1';this.coverAge=0;
  }

  /** Stage the first frame without starting audio, timers or a flight. */
  stagePreview(kind: CutsceneKind, params: EndingParams = {}) {
    this.begin(kind,params); this.step(0); this.render();
  }

  /** Compile/upload and wait for the horizon while the preceding screen still covers us. */
  async prepareView(signal?: AbortSignal) {
    const started = performance.now();
    // The overhead camera registered by EarthScenery covers the whole approach, not only
    // the launch camera. Render below the covering screen until those requests converge.
    while (!this.disposed && !signal?.aborted && this.scenery && !this.scenery.ready) {
      if (this.scenery.failed) throw new Error('Distant terrain could not load. Check the connection and retry.');
      if (performance.now()-started > 60000) throw new Error('Distant terrain is taking too long. Retry the landing view.');
      this.render();
      await new Promise<void>(resolve=>setTimeout(resolve,32));
    }
    if (this.disposed || signal?.aborted) return;
    // A warm-up can be cancelled by a refit or a rapid scene skip. compileAsync's internal
    // polling outlives disposed materials in Three.js; a hidden compile + draw finishes
    // the upload in this task, so cleanup never races an outstanding shader poll.
    this.renderer.compile(this.scene,this.camera);
    this.render();
  }

  /** Stop drawing an obscured view without releasing its resident terrain or GPU buffers. */
  setActive(active: boolean) {
    cancelAnimationFrame(this.raf);
    if (active && !this.disposed) { this.last=performance.now(); this.raf=requestAnimationFrame(this.tick); }
  }

  dispose() {
    if (this.disposed) return;
    if(this.finish&&(this.kind==='opening'||this.kind==='liftoff')){this.render();leaveHandoff(this.renderer.domElement);}
    this.disposed = true;
    this.scenery?.dispose(); cancelAnimationFrame(this.raf); this.finish?.(); this.ro.disconnect(); this.audio.stop();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
    });
    this.renderer.dispose(); this.renderer.domElement.remove(); this.ui.root.remove();
  }

  // ------------------------------------------------------------------ loop

  protected tick = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)); this.last = now;
    this.step(dt);
    this.render();
    if (this.kind && this.kind !== "live" && this.t >= this.duration && this.finish) {
      const ending = this.kind !== "opening" && this.kind !== "liftoff";
      if (!ending) leaveHandoff(this.renderer.domElement);     // the next scene dissolves from this frame
      this.finish();
      if (!ending) { this.kind = null; return; }      // opening and liftoff hold their last frame; endings keep smouldering
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  protected step(dt: number) {
    this.t += dt; this.frameDt = dt;
    if (this.coverAge >= 0) {                     // dissolve from the previous scene
      this.coverAge += dt;
      const u = this.coverAge / DISSOLVE;
      this.ui.cover.style.opacity = String(1 - easeInOut(u));
      if (u >= 1) { this.coverAge = -1; this.ui.cover.style.display = "none"; clearHandoff(); }
    }
    if (this.kind === "live") this.live(dt);
    else if (this.kind === "opening") this.opening(this.t, dt);
    else if (this.kind === "liftoff") this.liftoff(this.t, dt);
    else if (this.kind) this.ending(this.t, dt);
    this.updateDebris(dt); this.updateRings(dt); this.updateFree(dt);
    this.fire.update(dt); this.smoke.update(dt);
    this.flashLight.intensity *= Math.max(0, 1 - 3.5 * dt);
    this.trauma = Math.max(0, this.trauma - 0.75 * dt);
    const lp = this.lander.group.position;
    if (dt > 0) this.landerVel.copy(lp).sub(this.prevPos).divideScalar(dt);
    if (this.landerVel.length() > 150) this.landerVel.set(0, 0, 0);      // camera cut / teleport
    this.prevPos.copy(lp);
    const rp = this.rocket.group.position;                               // the rocket brakes from ~1.3 km/s
    if (dt > 0) this.rocketVel.copy(rp).sub(this.prevRocket).divideScalar(dt);
    if (this.rocketVel.length() > 2000) this.rocketVel.set(0, 0, 0);
    this.prevRocket.copy(rp);
  }

  /** Separates a rocket part from the stack; from now on it flies by itself. */
  protected release(obj: THREE.Object3D, vel: THREE.Vector3, acc: THREE.Vector3, spin: THREE.Vector3) {
    this.scene.attach(obj); this.free.push({ obj, vel, acc, spin });
  }

  protected updateFree(dt: number) {
    const q = new THREE.Quaternion();
    for (const f of this.free) {
      if (!f.obj.visible) continue;
      f.vel.addScaledVector(f.acc, dt); f.obj.position.addScaledVector(f.vel, dt);
      const w = f.spin.length();
      if (w > 1e-6) f.obj.quaternion.premultiply(q.setFromAxisAngle(f.spin.clone().divideScalar(w), w * dt));
      if (f.obj.position.y < this.terrain.heightAt(f.obj.position.x, f.obj.position.z) - 5) f.obj.visible = false;
    }
  }

  /** Hook for subclasses that drive the scene themselves (kind "live"). */
  protected live(_dt: number) { /* overridden */ }

  /** Jump to a moment of a cutscene and show that single frame. For tuning shots and for tests. */
  seek(kind: CutsceneKind, time: number, params: EndingParams = {}) {
    cancelAnimationFrame(this.raf); this.finish?.();
    this.begin(kind, params);
    while (this.t < time) this.step(1 / 60);
    this.render(); this.kind = null;
  }

  protected render() {
    // Shake follows smooth curves, not fresh random numbers each frame, so it reads as vibration
    // and not as flicker.
    const s = this.trauma * this.trauma, w = this.shakeClock += this.frameDt;
    const wob = (f: number, ph: number) => (Math.sin(w * f + ph) + 0.6 * Math.sin(w * f * 1.73 + ph * 2.1)) / 1.6;
    this.camera.position.copy(this.camPos).add(V(wob(31, 0), wob(37, 1.3), wob(29, 2.6)).multiplyScalar(s * 1.6));
    const floor = this.terrain.heightAt(this.camera.position.x, this.camera.position.z) + 0.8;
    if (this.camera.position.y < floor) this.camera.position.y = floor;
    this.camera.lookAt(this.camLook);
    this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
    const fog = this.scene.fog as THREE.Fog, high = Math.max(0, this.camera.position.y - floor);
    fog.near = 120 + high * 1.2; fog.far = this.look.fogFar + high * 7;        // see further from altitude
    this.camera.rotation.z += wob(23, 4.1) * s * 0.05;
    for (const r of this.rings) if (r.billboard) r.mesh.quaternion.copy(this.camera.quaternion);
    // the lander's shadow sits where the sun ray through it meets the ground, and closes in at touchdown
    // (the rocket's, while it still carries the lander)
    const onRocket = this.rocket.group.visible && !this.flags.released, focus = onRocket ? this.rocket.group : this.lander.group;
    const lp = focus.position, alt = Math.max(0, lp.y - this.terrain.heightAt(lp.x, lp.z));
    const k = alt / this.sunDir.y, sx = lp.x - this.sunDir.x * k, sz = lp.z - this.sunDir.z * k;
    this.shadow.position.set(sx, this.terrain.heightAt(sx, sz) + 0.08, sz);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = focus.visible ? 0.45 * clamp01(1 - alt / 500) : 0;
    this.shadow.scale.setScalar((1 + alt / 70) * (onRocket ? 1.4 : 1));
    if (this.scenery) fog.far = Math.max(fog.far, 20000);
    const streamed = this.scenery?.draw(this.camera, fog);
    if (streamed) {
      fog.far = Math.max(fog.far, 20000);
      this.sky.visible = false; this.renderer.autoClear = false;
    }
    this.renderer.render(this.scene, this.camera);
    this.sky.visible = true; this.renderer.autoClear = true;
  }

  /**
   * Places the camera. With camEase > 0 it follows on a critically damped spring, which has no
   * sudden changes of speed; the camera's velocity is tracked even while it is placed directly,
   * so switching easing on mid-flight carries on smoothly from the current motion.
   */
  protected setCam(pos: THREE.Vector3, look: THREE.Vector3) {
    const dt = Math.max(1e-3, this.frameDt);
    if (this.camEase <= 0) {
      this.camVel.copy(pos).sub(this.camPos).divideScalar(dt); this.lookVel.copy(look).sub(this.camLook).divideScalar(dt);
      if (this.camVel.length() > 400) this.camVel.set(0, 0, 0);          // a cut, not a movement
      if (this.lookVel.length() > 400) this.lookVel.set(0, 0, 0);
      this.camPos.copy(pos); this.camLook.copy(look); return;
    }
    const spring = (x: THREE.Vector3, v: THREE.Vector3, to: THREE.Vector3, w: number) => {
      v.addScaledVector(to.clone().sub(x), w * w * dt).multiplyScalar(1 / (1 + 2 * w * dt));
      x.addScaledVector(v, dt);
    };
    spring(this.camPos, this.camVel, pos, this.camEase); spring(this.camLook, this.lookVel, look, this.camEase * 1.5);
  }

  protected resetScene() {
    this.fire.clear(); this.smoke.clear();
    this.debris.forEach((d) => { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); (d.mesh.material as THREE.Material).dispose(); });
    this.rings.forEach((r) => { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); (r.mesh.material as THREE.Material).dispose(); });
    this.debris = []; this.rings = []; this.flags = {}; this.trauma = 0;
    this.acc = { exhaust: 0, dust: 0, wreckFire: 0, wreckSmoke: 0, trail: 0 };
    const L = this.lander;
    L.group.visible = true; L.group.rotation.set(0, 0.5, 0); L.group.scale.setScalar(1); L.group.position.set(0, 0, 0);
    L.mast.scale.y = 0.001; L.beaconMat.color.set(0x113322); L.flame.visible = false;
    L.setGear(1); L.setArrays(1);
    this.free = []; this.rocket.reset(); this.rocket.group.visible = false; this.pad.visible = false;
    this.scorch.visible = false; this.fireball.visible = false; this.targetRing.visible = false;
    this.engineLight.intensity = 0; this.flashLight.intensity = 0;
    this.caption("", ""); this.ui.fade.style.opacity = "0"; this.ui.flash.style.opacity = "0";
    this.audio.setThrust(0); this.audio.setWind(this.look.stars ? 0 : 1);
  }

  // ---------------------------------------------------------------- scenes

  /**
   * Opening: the rocket that lifted off arrives over the analog site, braking. It drops its four
   * strap-on boosters, splits its fairing and releases the lander, which unfolds its landing gear
   * and solar arrays and lights its engine. It ends exactly at the state where the physics
   * simulation takes over.
   */
  protected opening(t: number, dt: number) {
    const L = this.lander.group, R = this.rocket, h0 = this.terrain.heightAt(0, 0), END = DURATION_OPENING;
    const tgt = this.params.target ?? { x: 0, y: 0 }, p0 = this.params.start?.position;
    // SimInput.start.position is absolute; its default is 400 m west of the target, 1000 m up
    const sp = p0 ? { x: p0.x - tgt.x, y: p0.y - tgt.y, z: p0.z } : DEFAULT_START.position;
    const sv = { ...DEFAULT_START.velocity, ...this.params.start?.velocity };
    // sim (x east, y north, z up) -> scene (x east, y up, z south), with the target at the origin
    const sx = sp.x, sz = -sp.y;
    const S = V(sx, this.terrain.heightAt(sx, sz) + sp.z, sz), vel = V(sv.x, sv.z, -sv.y);
    const dir = vel.lengthSq() > 1 ? vel.clone().normalize() : V(0, -1, 0);
    const back = V(-vel.x, 0, -vel.z); if (back.lengthSq() < 1) back.set(-1, 0, 0); back.normalize();
    // The lander arrives along its hand-over line. Before 3.2 s it is still braking out of the entry
    // (extra distance that shrinks to nothing with zero slope), so speed and position are seamless.
    const ENTRY = OP.entry, ue = clamp01(t / ENTRY), extra = 1400 * Math.pow(1 - ue, 3);
    const P = S.clone().addScaledVector(vel, t - END).addScaledVector(dir, -extra);
    const stackVel = vel.clone().addScaledVector(dir, 3 * 1400 * (1 - ue) ** 2 / ENTRY);
    const behind = Math.atan2(back.z, back.x), fwd = V(-back.x, 0, -back.z);

    // ---- the lander: inside the fairing until it opens, then free; legs and arrays unfold
    L.visible = t >= OP.fairing;
    L.position.copy(P); this.orient(fwd, lerp(0.2, 0.06, easeInOut((t - OP.release) / 3)));
    this.lander.setGear(easeInOut((t - OP.gear) / 1.6)); this.lander.setArrays(easeInOut((t - OP.arrays) / 1.6));

    // ---- the rocket carries it until the release
    R.group.visible = true;
    if (!this.flags.released) {
      R.group.quaternion.copy(L.quaternion);
      R.group.position.copy(P).sub(V(0, PAYLOAD_Y, 0).applyQuaternion(L.quaternion));
      R.group.updateMatrixWorld(true);
    }
    const up = V(0, 1, 0).applyQuaternion(R.group.quaternion);
    // braking burn on every engine, ending just before the boosters go
    const burn = t < OP.boosters ? clamp01((t - 1.5) / 0.4) * clamp01((OP.boosters - 0.25 - t) / 0.35) : 0;
    // the lander lights its own engine for the hand-over (first, so the rocket's glow is not reset)
    const LIT = END - 2.1, lit = t > LIT;
    if (lit && !this.flags.lit) { this.flags.lit = true; this.trauma = 0.45; this.flashLight.position.copy(P); this.flashLight.intensity = 2500; }
    this.thrust(lit ? Math.min(0.7, (t - LIT) * 1.6) : 0, dt);
    this.rocketThrust(burn * 0.85, dt, [R.coreNozzle, ...R.boosterNozzles], false);
    if (t >= OP.boosters && !this.flags.boosters) {
      this.flags.boosters = true; this.audio.thud(); this.trauma = Math.max(this.trauma, 0.35);
      for (const b of R.boosters) {
        const at = b.getWorldPosition(V()), rel = at.clone().sub(R.group.position);
        const out = rel.addScaledVector(up, -rel.dot(up)).normalize();
        this.release(b, stackVel.clone().addScaledVector(out, 5).addScaledVector(up, -1.5), V(0, -6, 0), up.clone().cross(out).normalize().multiplyScalar(0.7));
        for (let i = 0; i < 16; i++) this.smoke.emit({ pos: at.clone().addScaledVector(up, rnd(2, 16)).addScaledVector(out, -0.6),
          vel: stackVel.clone().addScaledVector(out, rnd(3, 9)).add(V(rnd(-2, 2), rnd(-2, 2), rnd(-2, 2))), life: rnd(1, 2.2), size: [1.5, rnd(5, 9)], color: [0.92, 0.92, 0.92, 0.35], drag: 0.6 });
      }
    }
    if (t >= OP.fairing && !this.flags.fairingFree) R.setFairing(easeOut((t - OP.fairing) / (OP.fairingFree - OP.fairing)));
    if (t >= OP.fairing && !this.flags.fairing) {
      this.flags.fairing = true; this.audio.thud(); this.trauma = Math.max(this.trauma, 0.3);
      for (let i = 0; i < 30; i++) this.smoke.emit({ pos: R.group.localToWorld(V(0, rnd(PAYLOAD_Y, PAYLOAD_Y + 12), rnd(-3.2, 3.2))),
        vel: stackVel.clone().add(V(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3))), life: rnd(0.8, 1.8), size: [1, rnd(4, 7)], color: [0.95, 0.95, 0.95, 0.3], drag: 0.8 });
    }
    if (t >= OP.fairingFree && !this.flags.fairingFree) {
      this.flags.fairingFree = true;
      for (const f of R.fairing) {
        const out = f.out.clone().applyQuaternion(R.group.quaternion), axis = f.axis.clone().applyQuaternion(R.group.quaternion);
        this.release(f.pivot, stackVel.clone().addScaledVector(out, 10).addScaledVector(up, -2), V(0, -14, 0), axis.multiplyScalar(1.3));
      }
    }
    if (t >= OP.release && !this.flags.released) {
      this.flags.released = true; this.trauma = Math.max(this.trauma, 0.2);
      this.release(R.core, stackVel.clone().addScaledVector(up, -6), V(0, -16, 0), fwd.clone().cross(up).normalize().multiplyScalar(0.12));
    }

    // ---- entry glow on the leading end of the stack
    const glow = t < ENTRY ? Math.pow(1 - ue, 1.4) : 0, nose = R.group.position.clone().addScaledVector(up, -2);
    this.fireball.visible = glow > 0.04; this.fireball.position.copy(nose);
    this.fireball.scale.setScalar(glow * 2.4 * (0.92 + Math.random() * 0.16));

    // ---- camera: a wide shot of the whole stack, closing in on the lander once it is free, then
    // settling on exactly the chase framing the live descent view opens with (app/flightlab/view.ts:
    // behind the direction of travel, 34 m out, 0.32 rad up), so the hand-over has no jump.
    const C = P.clone().add(V(0, -9, 0));                       // the middle of the stack
    const azW = behind + lerp(1.4, 0.55, easeInOut((t - ENTRY) / (OP.release - ENTRY)));
    const W = C.clone().add(V(Math.cos(azW) * 80, 8, Math.sin(azW) * 80));
    const s1 = easeInOut((t - (OP.release - 0.4)) / 2.8), s2 = easeInOut((t - (END - 3.8)) / 3.45);
    const EL = 0.32, DIST = 34;
    if (t < ENTRY) {
      const u = easeInOut(ue), far = P.clone().add(V(Math.cos(behind + 1.4) * 380, -150, Math.sin(behind + 1.4) * 380));
      const cam = far.lerp(W, u), d = Math.max(0.3, nose.distanceTo(cam) / 300);   // plasma trail sized to stay readable at range
      this.acc.trail += dt * 260 * glow;
      while (this.acc.trail >= 1) {
        this.acc.trail--;
        this.fire.emit({ pos: nose.clone().add(V(rnd(-4, 4), rnd(-1, 5), rnd(-4, 4)).multiplyScalar(d)), vel: back.clone().multiplyScalar(rnd(10, 40)).add(V(rnd(-4, 4), rnd(2, 14), rnd(-4, 4))).multiplyScalar(d),
          life: rnd(0.5, 1.3), size: [rnd(10, 18) * d, 4 * d], color: [1, 0.55, 0.16, 0.5], colorEnd: [0.8, 0.12, 0.0, 0] });
        if (Math.random() < 0.3) this.smoke.emit({ pos: nose.clone(), vel: V(rnd(-3, 3), rnd(0, 5), rnd(-3, 3)).multiplyScalar(d), life: rnd(2, 3.5), size: [8 * d, 26 * d], color: [0.85, 0.85, 0.85, 0.22] });
      }
      this.setCam(cam, P.clone().lerp(C, u));
    } else if (s2 <= 0) {
      const K = P.clone().add(V(Math.cos(behind + 0.5) * 17, 2, Math.sin(behind + 0.5) * 17));
      this.setCam(W.lerp(K, s1), C.lerp(P.clone().add(V(0, 2, 0)), s1));
    } else {
      const az = lerp(behind + 0.5, behind, s2), r = lerp(17, DIST * Math.cos(EL), s2), y = lerp(2, DIST * Math.sin(EL), s2);
      const aim = V(0, h0, 0).sub(P).multiplyScalar(0.1); if (aim.length() > DIST * 0.2) aim.setLength(DIST * 0.2);
      this.setCam(P.clone().add(V(Math.cos(az) * r, y, Math.sin(az) * r)), P.clone().add(V(0, lerp(2, 1.5, s2), 0)).addScaledVector(aim, s2));
    }

    if (!lit) this.audio.setThrust(0.12 + 0.45 * glow + 0.35 * burn);
    this.targetRing.visible = t > END - 3; this.targetRing.position.set(0, h0 + 1.5, 0);
    this.targetRing.scale.setScalar(Math.max(18, P.distanceTo(V(0, h0, 0)) * 0.05) * (1 + 0.12 * Math.sin(t * 5)));
    this.trauma = Math.max(this.trauma, lit ? 0.16 : t < ENTRY ? 0.1 + 0.2 * glow + 0.25 * burn : lerp(0.1 + 0.25 * burn, 0.06, s2));
    if (!this.flags.whoosh) { this.flags.whoosh = true; this.audio.whoosh(2.6, 0.6); }
    if (t > 0.5 && t < 3.9) this.caption(this.env.name, this.env.subtitle ?? "Earth analog test flight");
    else if (t >= OP.boosters && t < OP.fairing) this.caption("Booster separation", "Strap-on thrusters jettisoned");
    else if (t >= OP.fairing && t < OP.release) this.caption("Fairing separation", "Exposing the lander");
    else if (t >= OP.release && t < OP.arrays + 1.6) this.caption("Lander deployed", "Landing gear extending");
    else if (t > END - 2) this.caption("Descent simulation", `Altitude ${Math.round(sp.z)} m · ${this.env.control === "manual" ? "you have control" : this.env.control === "autonomous" ? "autopilot engaged" : "descent beginning"}`);
    else this.caption("", "");
    // no fade out: the live descent dissolves from this last frame on the same framing
  }

  /** Liftoff: the rocket carrying the lander lights up on its pad, blasts the dust away and climbs out. */
  protected liftoff(t: number, dt: number) {
    const R = this.rocket, h0 = this.terrain.heightAt(0, 0), END = DURATION_LIFTOFF;
    const up = this.liftoffClimb(t), pitch = easeInOut((t - 4.8) / 3.5);
    const east = t > 4.8 ? 0.5 * 2.6 * (t - 4.8) ** 2 : 0;    // pitches over towards orbit
    this.lander.group.visible = false; R.group.visible = true; this.pad.visible = true;
    R.group.position.set(east, h0 + up, 0);
    this.orientObj(R.group, V(1, 0, 0), 0.3 * pitch);
    const throttle = t < LO.ignite ? 0 : Math.min(1, (t - LO.ignite) / 0.6);
    if (t < LO.ignite) {                                          // cryogenic venting before ignition
      this.acc.trail += dt * 22;
      while (this.acc.trail >= 1) {
        this.acc.trail--;
        const a = Math.random() * Math.PI * 2;
        this.smoke.emit({ pos: V(Math.cos(a) * 2.1, h0 + rnd(6, 30), Math.sin(a) * 2.1), vel: V(Math.cos(a) * rnd(1, 3), rnd(-2.5, -0.5), Math.sin(a) * rnd(1, 3)),
          life: rnd(1.5, 2.5), size: [0.8, rnd(3, 5)], color: [0.95, 0.96, 0.98, 0.3], drag: 0.8 });
      }
    }
    if (t >= LO.ignite && !this.flags.lit) {
      this.flags.lit = true; this.audio.thud(); this.trauma = 0.8;
      this.flashLight.position.set(0, h0 + 3, 0); this.flashLight.intensity = 1600;
      this.dustPuff(V(0, h0, 0), 220, 34);
    }
    if (t < LO.rise && throttle > 0) this.trauma = Math.max(this.trauma, 0.5);        // straining on the pad
    this.rocketThrust(throttle, dt, [R.coreNozzle, ...R.boosterNozzles]);
    if (throttle > 0) this.trauma = Math.max(this.trauma, 0.14 + 0.3 * clamp01(1 - up / 90));
    const u = easeInOut((t - 3) / (END - 3));
    this.setCam(this.liftoffCam(t), R.group.position.clone().add(V(0, lerp(20, 15, u), 0)));
    if (t > 0.3 && t < 3.6) this.caption(this.env.name, this.env.subtitle ?? "Departure");
    else if (t > 5.2) this.caption("Liftoff", "Carrying the lander to orbit");
    else this.caption("", "");
  }

  protected liftoffClimb(t: number) { return t > LO.rise ? 0.5 * LO.climb * (t - LO.rise) ** 2 : 0; }

  /**
   * Liftoff camera: low beside the pad, then up out of the dust sheet as the engines light, and
   * back and up after the climbing rocket. The sun is behind it, so the rocket is lit, not a silhouette.
   */
  protected liftoffCam(t: number) {
    const h0 = this.terrain.heightAt(0, 0), sunSide = Math.atan2(this.sunDir.z, this.sunDir.x);
    const u = easeInOut((t - 3) / (DURATION_LIFTOFF - 3)), a = sunSide + 0.55 - 0.25 * u, r = lerp(62, 120, u);
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const y = h0 + 3 + 10 * easeInOut((t - 1.3) / 1.8) + 25 * u + 0.35 * this.liftoffClimb(t);
    return V(cx, Math.max(y, this.terrain.heightAt(cx, cz) + 1.6), cz);
  }

  /**
   * Rocket engines: a flame on each firing nozzle, the exhaust, the engine glow and, near the
   * ground, the sheet of dust and steam they raise. `firing` lists the nozzles that burn.
   */
  protected rocketThrust(throttle: number, dt: number, firing: Nozzle[], sound = true) {
    const R = this.rocket, on = throttle > 0.02 && R.group.visible;
    const vac = 1 - clamp01(this.air / 0.4), spread = lerp(4, 14, vac);
    for (const n of [R.coreNozzle, ...R.boosterNozzles]) {
      const lit = on && n.part.visible && firing.includes(n);
      n.flame.visible = lit;
      if (lit) { const w = (0.85 + 0.3 * throttle) * lerp(1, 1.7, vac); n.flame.scale.set(w, throttle * (0.8 + Math.random() * 0.4), w); }
    }
    if (sound) this.audio.setThrust(throttle);
    if (!on || !firing.length) return;
    const q = new THREE.Quaternion();
    this.acc.exhaust += dt * 420 * throttle;
    while (this.acc.exhaust >= 1) {
      this.acc.exhaust--;
      const n = firing[Math.floor(Math.random() * firing.length)];
      const at = n.part.localToWorld(n.at.clone()), down = V(0, -1, 0).applyQuaternion(n.part.getWorldQuaternion(q));
      this.fire.emit({ pos: at.addScaledVector(down, rnd(0, 2) * n.size).add(V(rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4)).multiplyScalar(n.size)),
        vel: down.multiplyScalar(rnd(45, 75)).add(V(rnd(-spread, spread), rnd(-2, 2), rnd(-spread, spread))).add(this.rocketVel),
        life: rnd(0.22, 0.5), size: [rnd(1.4, 2.2) * n.size, rnd(3.5, 5.5) * n.size * lerp(1, 1.5, vac)], color: [1, 0.85, 0.6, lerp(0.8, 0.45, vac)], colorEnd: [1, 0.4, 0.08, 0] });
    }
    const base = R.coreNozzle.part.localToWorld(R.coreNozzle.at.clone());
    this.engineLight.position.copy(base).add(V(0, -3, 0)); this.engineLight.intensity = throttle * 900 * (0.8 + Math.random() * 0.4);
    const gh = this.terrain.heightAt(base.x, base.z), near = clamp01(1 - (base.y - gh) / 90);
    if (near <= 0) return;
    const [r, g, b] = this.look.dust;
    this.acc.dust += dt * 260 * throttle * near * near * this.dustLevel;
    while (this.acc.dust >= 1) {
      this.acc.dust--;
      const a = Math.random() * Math.PI * 2, sp = rnd(14, 42) * (0.5 + near) * lerp(1, 2, vac);
      this.smoke.emit({ pos: V(base.x + Math.cos(a) * rnd(2, 7), gh + 0.8, base.z + Math.sin(a) * rnd(2, 7)),
        vel: V(Math.cos(a) * sp + this.wind.x * (1 - vac), rnd(1, 7) * lerp(1, 0.5, vac), Math.sin(a) * sp + this.wind.z * (1 - vac)),
        life: rnd(2.5, 5) * lerp(1, 0.7, vac), size: [rnd(4, 7), rnd(16, 30) * lerp(1, 0.6, vac)],
        color: [lerp(r, 0.85, 0.5), lerp(g, 0.85, 0.5), lerp(b, 0.85, 0.5), 0.3 * near + 0.08], drag: lerp(0.9, 0.05, vac), gravity: this.gravity * vac * 0.5 });
    }
  }

  /** Hides the scattered rocks within `radius` metres (horizontally) of any of `points`. */
  protected clearRocks(points: THREE.Vector3[], radius: number) {
    const m = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.terrain.group.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (!im.isInstancedMesh) return;
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m);
        const x = m.elements[12], z = m.elements[14];
        if (points.some((p) => Math.hypot(p.x - x, p.z - z) < radius)) im.setMatrixAt(i, zero);
      }
      im.instanceMatrix.needsUpdate = true;
    });
  }

  /** Ending: replays the last seconds of the flight, then plays what the outcome calls for. */
  protected ending(t: number, dt: number) {
    const L = this.lander.group, tr = this.track!, c = this.tdPoint, h0 = c.y, TD = tr.duration;
    const out = tr.outcome, c0 = this.cam0;
    const ring = (ang: number, r: number, dY: number) => {
      const x = c.x + Math.cos(ang) * r, z = c.z + Math.sin(ang) * r;
      return V(x, this.terrain.heightAt(x, z) + 2.4 + dY, z);
    };
    if (t < TD) {
      const s = sampleTrack(tr, t);
      L.position.copy(s.pos); this.orient(s.lean, s.tilt);
      this.thrust(s.throttle, dt);
      this.setCam(ring(c0.ang, c0.r, 0), s.pos.clone().add(V(0, 1.5, 0)));
      this.trauma = Math.max(this.trauma, 0.1 + 0.1 * s.throttle);
      return;
    }
    const k = t - TD, orbit = (dAng: number, dR: number, dY: number, lookY: number) =>
      this.setCam(ring(c0.ang + dAng, c0.r + dR, dY), V(c.x, h0 + lookY, c.z));
    if (out === "timeout") {
      const s = sampleTrack(tr, TD);
      L.position.copy(s.pos); this.thrust(s.throttle, dt);
      this.setCam(this.camPos, s.pos.clone().add(V(0, 1.5, 0)));
      this.caption("Flight timed out", tr.reason ?? "No landing within the time limit");
      return;
    }
    if (out === "crash") {
      if (!this.flags.hit) { this.flags.hit = true; this.explode(c.clone(), clamp01(0.5 + tr.impact / 40), tr.push); }
      this.thrust(0, dt);
      this.acc.wreckFire += dt * 55; this.acc.wreckSmoke += dt * 16;
      while (this.acc.wreckFire >= 1) {
        this.acc.wreckFire--;
        this.fire.emit({ pos: V(c.x + rnd(-2.5, 2.5), h0 + rnd(0.2, 1), c.z + rnd(-2.5, 2.5)), vel: V(rnd(-1, 1), rnd(2.5, 7), rnd(-1, 1)),
          life: rnd(0.5, 1.2), size: [rnd(2.2, 4.2), 0.5], color: [1, 0.6, 0.2, 0.6], colorEnd: [0.85, 0.1, 0, 0] });
      }
      while (this.acc.wreckSmoke >= 1) {
        this.acc.wreckSmoke--;
        this.smoke.emit({ pos: V(c.x + rnd(-2, 2), h0 + rnd(1, 2.5), c.z + rnd(-2, 2)), vel: V(rnd(-1, 1) + 2.2 + this.wind.x, rnd(5, 9), rnd(-1, 1) + this.wind.z),
          life: rnd(3.5, 6), size: [3, rnd(11, 17)], color: [0.11, 0.1, 0.095, 0.42], drag: 0.25 });
      }
      this.engineLight.position.set(c.x, h0 + 2, c.z); this.engineLight.intensity = 260 * (0.7 + Math.random() * 0.5);
      orbit(k * 0.05, 8 + easeOut(k / 5) * 26, easeOut(k / 5) * 11, 3 + easeOut(k / 4) * 7);
      this.ui.flash.style.opacity = String(Math.max(0, 0.9 - k * 3.2));
      if (k > 1.3) this.caption("Signal lost", tr.reason ?? `Impact at ${tr.impact.toFixed(1)} m/s`);
      return;
    }
    // the vehicle is on the ground in one piece
    const hard = out === "hard-landing", tip = out === "tip-over";
    if (!this.flags.td) {
      this.flags.td = true; this.audio.thud();
      this.trauma = hard ? 0.75 : 0.38; this.dustPuff(c, hard ? 130 : 60, hard ? 26 : 16);
      if (hard) for (let i = 0; i < 26; i++) this.fire.emit({ pos: V(c.x + rnd(-3, 3), h0 + 0.2, c.z + rnd(-3, 3)), vel: V(rnd(-9, 9), rnd(3, 11), rnd(-9, 9)),
        life: rnd(0.4, 1), size: [0.5, 0.15], color: [1, 0.85, 0.5, 1], colorEnd: [1, 0.4, 0.1, 0], gravity: this.gravity });
    }
    L.position.copy(c); this.thrust(0, dt);
    if (tip) {
      const FALL = 1.8, u = Math.min(1, k / FALL), angle = lerp(tr.endTilt, 1.42, u * u * u);
      this.orient(this.downhill, angle);
      L.position.addScaledVector(this.downhill, Math.sin(angle) * 1.2); L.position.y += Math.sin(angle) * 1.45;
      if (u >= 1 && !this.flags.fell) {
        this.flags.fell = true; this.audio.thud(); this.trauma = 0.7; this.dustPuff(c, 110, 20);
        this.spawnDebris(L.position.clone().add(V(0, 1, 0)), 9, 0.35, this.downhill.clone().multiplyScalar(5));
      }
      if (k > FALL + 0.6) this.caption("Tip-over", tr.reason ?? "Vehicle fell on touchdown");
    } else {
      this.orient(hard ? V(1, 0, 0.4).normalize() : tr.endLean, hard ? 0.07 : tr.endTilt * Math.exp(-k * 3));
      L.scale.y = 1 - (hard ? 0.16 : 0.07) * Math.exp(-k * 7) * Math.cos(k * 22);        // legs settle
      this.lander.mast.scale.y = Math.max(0.001, easeOut((k - 1.6) / 1.1));
      if (k > 2.7) {
        const phase = (k - 2.7) % 0.9, n = Math.floor((k - 2.7) / 0.9), color = hard ? 0xffb040 : 0x66ffaa;
        this.lander.beaconMat.color.set(phase < 0.18 ? color : 0x113322);
        if (this.flags["b" + n] !== true) {
          this.flags["b" + n] = true; this.audio.beep(hard ? 520 : n % 2 ? 990 : 880);
          this.addRing(this.lander.beaconTip.getWorldPosition(V()), color, 0.3, 7, 0.9, true);
        }
        this.caption(hard ? "Hard landing" : "Touchdown confirmed",
          hard ? `${tr.reason ?? "Landing gear damaged"} · survivability ${tr.survivability}%`
               : `Sink rate ${tr.sink.toFixed(2)} m/s · survivability ${tr.survivability}%`);
      }
    }
    orbit(k * 0.11, k * 1.5, k * 0.55, 2.6);
  }

  /** Leans the lander by `angle` radians towards a horizontal direction. */
  protected orient(lean: THREE.Vector3, angle: number) { this.orientObj(this.lander.group, lean, angle); }

  /** Leans any object by `angle` radians towards a horizontal direction, with the lander's yaw. */
  protected orientObj(obj: THREE.Object3D, lean: THREE.Vector3, angle: number) {
    const q = obj.quaternion;
    if (lean.lengthSq() < 1e-6 || Math.abs(angle) < 1e-5) { q.setFromAxisAngle(V(0, 1, 0), 0.5); return; }
    q.setFromAxisAngle(V(lean.z, 0, -lean.x).normalize(), angle).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.5));
  }

  // ------------------------------------------------------------------- VFX

  /** Engine plume, engine glow, rumble, and ground dust when close to the surface. */
  protected thrust(throttle: number, dt: number) {
    const L = this.lander, g = L.group;
    L.flame.visible = throttle > 0.02 && g.visible;
    L.flame.scale.set(0.8 + throttle * 0.4, throttle * (0.75 + Math.random() * 0.5), 0.8 + throttle * 0.4);
    this.audio.setThrust(throttle);
    if (this.kind !== "crash" || !this.flags.hit) this.engineLight.intensity = throttle * 160 * (0.8 + Math.random() * 0.4);
    if (throttle <= 0.02 || !g.visible) return;
    const nozzle = g.localToWorld(V(0, L.nozzleY, 0));
    const down = V(0, -1, 0).applyQuaternion(g.quaternion);
    this.engineLight.position.copy(nozzle).addScaledVector(down, 2);
    // In thin air the plume is under-expanded and spreads wide; in dense air it stays a narrow jet.
    const vac = 1 - clamp01(this.air / 0.4), spread = lerp(3, 11, vac);
    L.flame.scale.x = L.flame.scale.z = (0.8 + throttle * 0.4) * lerp(1, 1.9, vac);
    this.acc.exhaust += dt * 260 * throttle;
    while (this.acc.exhaust >= 1) {
      this.acc.exhaust--;
      this.fire.emit({ pos: nozzle.clone().addScaledVector(down, rnd(0, 1.5)), vel: down.clone().multiplyScalar(rnd(26, 40)).add(V(rnd(-spread, spread), rnd(-2, 2), rnd(-spread, spread))).add(this.landerVel),
        life: rnd(0.18, 0.4), size: [rnd(0.9, 1.5), rnd(2.2, 3.4) * lerp(1, 1.6, vac)], color: [0.75, 0.85, 1, lerp(0.75, 0.4, vac)], colorEnd: [1, 0.45, 0.1, 0] });
    }
    const gh = this.terrain.heightAt(nozzle.x, nozzle.z), alt = nozzle.y - gh;
    const near = clamp01(1 - alt / 48);
    if (near <= 0) return;
    // Dust: with air it billows, slows down and drifts with the wind. Without air each grain flies a
    // ballistic arc, so the sheet shoots out flat and fast and falls back with nothing left hanging.
    const [r, gg, b] = this.look.dust;
    this.acc.dust += dt * 230 * throttle * near * near * this.dustLevel;
    while (this.acc.dust >= 1) {
      this.acc.dust--;
      const a = Math.random() * Math.PI * 2, sp = rnd(7, 24) * (0.5 + near) * lerp(1, 2.2, vac);
      this.smoke.emit({ pos: V(nozzle.x + Math.cos(a) * rnd(0.5, 3), gh + 0.3, nozzle.z + Math.sin(a) * rnd(0.5, 3)),
        vel: V(Math.cos(a) * sp + this.wind.x * (1 - vac), rnd(0.5, 4.5) * lerp(1, 0.5, vac), Math.sin(a) * sp + this.wind.z * (1 - vac)),
        life: rnd(1.4, 3.2) * lerp(1, 0.7, vac), size: [rnd(1.5, 3), rnd(7, 13) * lerp(1, 0.55, vac)],
        color: [r, gg, b, (0.32 * near + 0.08) * Math.min(1.6, 0.6 + 0.4 * this.dustLevel)], drag: lerp(1.1, 0.05, vac), gravity: this.gravity * vac * 0.5 });
    }
  }

  protected dustPuff(c: THREE.Vector3, count: number, speed: number) {
    const [r, g, b] = this.look.dust;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = rnd(0.4, 1) * speed;
      this.smoke.emit({ pos: V(c.x + Math.cos(a) * 2.5, c.y + 0.3, c.z + Math.sin(a) * 2.5), vel: V(Math.cos(a) * sp, rnd(0.5, 3), Math.sin(a) * sp),
        life: rnd(2, 4), size: [2, rnd(8, 14)], color: [r, g, b, 0.4], drag: 1.3 });
    }
  }

  protected explode(at: THREE.Vector3, power: number, push: THREE.Vector3) {
    this.lander.group.visible = false; this.lander.flame.visible = false;
    this.audio.explosion(power); this.trauma = 1;
    this.flashLight.position.copy(at).add(V(0, 6, 0)); this.flashLight.intensity = 9000 * power;
    this.scorch.position.set(at.x, at.y + 0.08, at.z); this.scorch.visible = true;
    const [dr, dg, db] = this.look.dust;
    for (let i = 0; i < 260 * power; i++) {                                   // fireball
      const d = V(rnd(-1, 1), rnd(0.05, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(8, 46) * power); d.addScaledVector(push, 0.5);
      this.fire.emit({ pos: at.clone().add(V(rnd(-1.5, 1.5), rnd(0.3, 2), rnd(-1.5, 1.5))), vel: d, life: rnd(0.7, 2.1),
        size: [rnd(3, 6), rnd(9, 15)], color: [1, 0.62, 0.22, 0.55], colorEnd: [0.7, 0.08, 0, 0], drag: 2.0 });
    }
    for (let i = 0; i < 110; i++) {                                           // smoke column
      const d = V(rnd(-1, 1), rnd(0.5, 1.6), rnd(-1, 1)).normalize().multiplyScalar(rnd(5, 22)); d.addScaledVector(push, 0.3);
      this.smoke.emit({ pos: at.clone().add(V(rnd(-2, 2), rnd(0.5, 3), rnd(-2, 2))), vel: d, life: rnd(3, 6.5),
        size: [rnd(4, 7), rnd(16, 26)], color: [0.13, 0.12, 0.11, 0.5], drag: 0.9 });
    }
    for (let i = 0; i < 150; i++) {                                           // ground dust ring
      const a = Math.random() * Math.PI * 2, sp = rnd(16, 46);
      this.smoke.emit({ pos: at.clone().add(V(Math.cos(a) * 3, 0.4, Math.sin(a) * 3)), vel: V(Math.cos(a) * sp, rnd(0.5, 5), Math.sin(a) * sp),
        life: rnd(2, 4.5), size: [3, rnd(11, 19)], color: [dr, dg, db, 0.45], drag: 1.2 });
    }
    for (let i = 0; i < 70; i++) {                                            // sparks
      const d = V(rnd(-1, 1), rnd(0.3, 1.4), rnd(-1, 1)).normalize().multiplyScalar(rnd(20, 60));
      this.fire.emit({ pos: at.clone().add(V(0, 1, 0)), vel: d, life: rnd(0.8, 2), size: [0.7, 0.2], color: [1, 0.9, 0.6, 1], colorEnd: [1, 0.4, 0.1, 0], gravity: this.gravity, drag: 0.3 });
    }
    this.spawnDebris(at, 42, power, push.clone().multiplyScalar(0.6));
    this.addRing(at.clone().add(V(0, 0.25, 0)), 0xffe2b0, 2, 95, 0.9, false);  // shockwave
  }

  protected spawnDebris(at: THREE.Vector3, count: number, power: number, push: THREE.Vector3) {
    const colors = this.lander.debrisColors;
    for (let i = 0; i < count; i++) {
      const s = rnd(0.18, 0.95);
      const geo = i % 3 === 0 ? new THREE.BoxGeometry(s * 2, s * 0.12, s) : i % 3 === 1 ? new THREE.TetrahedronGeometry(s) : new THREE.CylinderGeometry(s * 0.12, s * 0.12, s * 3, 5);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i % colors.length], metalness: 0.6, roughness: 0.5, flatShading: true }));
      mesh.position.copy(at).add(V(rnd(-1.5, 1.5), rnd(0.5, 3), rnd(-1.5, 1.5)));
      const a = Math.random() * Math.PI * 2, sp = rnd(5, 30) * power;
      this.debris.push({ mesh, vel: V(Math.cos(a) * sp, rnd(9, 34) * power, Math.sin(a) * sp).add(push), spin: V(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9)), resting: false });
      this.scene.add(mesh);
    }
  }

  protected updateDebris(dt: number) {
    for (const d of this.debris) {
      if (d.resting) continue;
      d.vel.y -= this.gravity * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt; d.mesh.rotation.z += d.spin.z * dt;
      const gh = this.terrain.heightAt(d.mesh.position.x, d.mesh.position.z) + 0.1;
      if (d.mesh.position.y < gh) {
        d.mesh.position.y = gh;
        if (Math.abs(d.vel.y) < 2.2) { d.resting = true; continue; }
        d.vel.set(d.vel.x * 0.55, -d.vel.y * 0.32, d.vel.z * 0.55); d.spin.multiplyScalar(0.5);
        const [r, g, b] = this.look.dust;
        this.smoke.emit({ pos: d.mesh.position.clone(), vel: V(rnd(-1, 1), rnd(1, 2.5), rnd(-1, 1)), life: 1.2, size: [1, 4], color: [r, g, b, 0.35] });
      }
    }
  }

  protected addRing(at: THREE.Vector3, color: number, from: number, to: number, life: number, billboard: boolean) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    mesh.position.copy(at); if (!billboard) mesh.rotation.x = -Math.PI / 2;
    this.scene.add(mesh); this.rings.push({ mesh, age: 0, life, from, to, billboard });
  }

  protected updateRings(dt: number) {
    this.rings = this.rings.filter((r) => {
      r.age += dt; const u = r.age / r.life;
      if (u >= 1) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); (r.mesh.material as THREE.Material).dispose(); return false; }
      r.mesh.scale.setScalar(lerp(r.from, r.to, easeOut(u)));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - u);
      return true;
    });
  }

  // ----------------------------------------------------------------- setup

  protected buildSky() {
    const geo = new THREE.SphereGeometry(7000, 32, 20);
    const top = new THREE.Color(this.look.skyTop), hor = new THREE.Color(this.look.skyHorizon), c = new THREE.Color();
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      c.copy(hor).lerp(top, Math.pow(clamp01(pos.getY(i) / 7000), 0.55));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
    if (this.look.stars) {
      const n = 1400, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const v = V(rnd(-1, 1), rnd(0.02, 1), rnd(-1, 1)).normalize().multiplyScalar(6500); p.set([v.x, v.y, v.z], i * 3); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(p, 3));
      group.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
    }
    return group;
  }

  /** Soft radial falloff. `onBlack` gives a greyscale version usable as an alphaMap. */
  protected glowTexture(onBlack = false) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const ctx = c.getContext("2d")!, g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (onBlack) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 128, 128); g.addColorStop(0.45, "rgba(255,255,255,1)"); }
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.12, "rgba(255,255,255,0.9)");
    g.addColorStop(0.3, "rgba(255,255,255,0.25)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  protected buildOverlay(showSkip: boolean, letterbox: boolean) {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, css: string, parent: HTMLElement) => {
      const e = document.createElement(tag); e.style.cssText = css; parent.appendChild(e); return e;
    };
    const root = el("div", "position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:var(--font-ui, sans-serif);color:#fff", this.container);
    const bar = "position:absolute;left:0;right:0;height:9%;background:#000";
    const cover = el("div", "position:absolute;inset:0;background:#000 center/cover no-repeat", root);
    const flash = el("div", "position:absolute;inset:0;background:#fff;opacity:0", root);
    if (letterbox) { el("div", bar + ";top:0", root); el("div", bar + ";bottom:0", root); }
    const fade = el("div", "position:absolute;inset:0;background:#000;opacity:0", root);
    const cap = el("div", "position:absolute;left:6%;right:6%;bottom:15%;max-height:65%;overflow:auto;overflow-wrap:anywhere;line-height:1.4;opacity:0;transition:opacity .6s;text-shadow:0 2px 12px rgba(0,0,0,.7)", root);
    const title = el("div", "font-size:clamp(20px,3.6vw,46px);font-weight:700;letter-spacing:.14em;text-transform:uppercase", cap);
    const sub = el("div", "font-size:clamp(11px,1.4vw,17px);letter-spacing:.2em;text-transform:uppercase;opacity:.85;margin-top:.4em", cap);
    const skip = el("button", "position:absolute;right:3%;bottom:11%;pointer-events:auto;display:none;background:rgba(0,0,0,.45);color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:6px;padding:6px 14px;font:inherit;font-size:13px;letter-spacing:.1em;cursor:pointer", root);
    skip.textContent = "SKIP ▸"; skip.onclick = () => this.skip();
    if (!showSkip) skip.style.visibility = "hidden";
    return { root, title, sub, cap, flash, fade, skip, cover };
  }

  protected caption(title: string, sub: string) {
    if (this.ui.title.textContent !== title && title) this.ui.title.textContent = title;
    if (this.ui.sub.textContent !== sub && title) this.ui.sub.textContent = sub;
    this.ui.cap.style.opacity = title ? "1" : "0";
    this.ui.cap.style.pointerEvents = title ? "auto" : "none";
  }

  protected resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const px = h * this.renderer.getPixelRatio();
    this.fire.setViewport(px, this.camera.fov); this.smoke.setViewport(px, this.camera.fov);
    if (!this.kind && !this.disposed && this.lander) this.render();
  }
}

export { V, lerp, clamp01, easeOut, easeInOut, rnd, TAIL };
export type { Track };
