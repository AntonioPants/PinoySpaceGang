/**
 * First-person movement inside the cabin: the camera is the character. Walk with W A S D or the
 * arrow keys, drag to look. No pointer lock, so the cursor stays free to use the monitors.
 * The pure helpers at the top are what the tests cover.
 */
import { CABIN, STATIONS, type Station, type StationId } from './stations';

export interface Pose { x: number; z: number; yaw: number; pitch: number }

const RAD = Math.PI / 180;
export const START_POSE: Pose = { x: 0, z: 0.6, yaw: 0, pitch: 0 };
const PITCH_LIMIT = 55 * RAD;

/** Keeps a floor position inside the walkable circle. */
export function clampToCabin(x: number, z: number, radius: number = CABIN.walkM): { x: number; z: number } {
  const d = Math.hypot(x, z);
  return d <= radius ? { x, z } : { x: (x / d) * radius, z: (z / d) * radius };
}

/** The pose for standing in front of a wall position and looking at it. */
export function poseFacing(angleDeg: number, standM: number = CABIN.standM): Pose {
  const a = angleDeg * RAD, r = CABIN.wallM - standM;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r, yaw: a, pitch: 0 };
}

/** The next (or previous) station, wrapping round. With no current station, the first (or last). */
export function nextStation(current: StationId | null, step: 1 | -1 = 1): Station {
  const i = STATIONS.findIndex(s => s.id === current);
  if (i < 0) return step === 1 ? STATIONS[0] : STATIONS[STATIONS.length - 1];
  return STATIONS[(i + step + STATIONS.length) % STATIONS.length];
}

/** The station whose monitor is closest to where the player stands and looks. */
export function nearestStation(pose: Pose): Station {
  let best = STATIONS[0], bestScore = Infinity;
  for (const s of STATIONS) {
    const a = s.angleDeg * RAD;
    const dist = Math.hypot(Math.sin(a) * CABIN.wallM - pose.x, -Math.cos(a) * CABIN.wallM - pose.z);
    const turn = Math.abs(shortestTurn(pose.yaw, a));
    const score = dist + turn * 1.2;          // metres plus radians: favour what the player faces
    if (score < bestScore) { best = s; bestScore = score; }
  }
  return best;
}

/** Signed smallest rotation from one heading to another, radians. */
export function shortestTurn(from: number, to: number): number {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** One step of walking: `forward` and `strafe` are -1..1, in the direction the player faces. */
export function walk(pose: Pose, forward: number, strafe: number, dt: number, speedMps = 1.9): Pose {
  const n = Math.hypot(forward, strafe);
  if (n === 0) return pose;
  const f = forward / Math.max(1, n), s = strafe / Math.max(1, n);
  const x = pose.x + (Math.sin(pose.yaw) * f + Math.cos(pose.yaw) * s) * speedMps * dt;
  const z = pose.z + (-Math.cos(pose.yaw) * f + Math.sin(pose.yaw) * s) * speedMps * dt;
  return { ...pose, ...clampToCabin(x, z) };
}

const isFormControl = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName);

export interface FirstPersonOptions {
  /** Snap to stations instead of gliding. */
  reducedMotion: boolean;
  /** Called when the player goes to a station by key, so its screen can take keyboard focus. */
  onStation?: (id: StationId) => void;
}

/** Owns the pose, the keyboard and the mouse. Call update() every frame and dispose() at the end. */
export class FirstPerson {
  pose: Pose = { ...START_POSE };
  private keys = new Set<string>();
  private glide: { from: Pose; to: Pose; t: number } | null = null;
  private drag: { x: number; y: number } | null = null;
  private off: Array<() => void> = [];

  constructor(surface: HTMLElement, private opts: FirstPersonOptions) {
    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void) => {
      target.addEventListener(type, fn as EventListener);
      this.off.push(() => target.removeEventListener(type, fn as EventListener));
    };
    on(window, 'keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Keys typed into a monitor's field belong to that field. Escape steps back from it, and
      // the station numbers still work from menus and buttons (but not while typing a number).
      const tag = isFormControl(e.target) ? (e.target as HTMLElement).tagName : '';
      if (tag && e.code === 'Escape') { (e.target as HTMLElement).blur(); return; }
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const station = STATIONS.find(s => s.key === e.key);
      if (station) { this.goTo(station.id, true); e.preventDefault(); return; }
      if (e.key === '5') { this.lookAtWindow(); (document.activeElement as HTMLElement | null)?.blur?.(); e.preventDefault(); return; }
      if (tag === 'SELECT') return;                       // letters and arrows drive the menu
      if (tag === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space')) return;
      if (e.code === 'KeyE') { this.goTo(nearestStation(this.pose).id, true); e.preventDefault(); return; }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) { this.keys.add(e.code); this.glide = null; e.preventDefault(); }
    });
    on(window, 'keyup', e => this.keys.delete(e.code));
    on(window, 'blur', () => { this.keys.clear(); this.drag = null; });
    on(surface, 'pointerdown', e => {
      if (e.button !== 0 || isFormControl(e.target) || (e.target as HTMLElement).closest('.monitor-screen')) return;
      this.drag = { x: e.clientX, y: e.clientY }; this.glide = null; surface.setPointerCapture(e.pointerId);
    });
    on(surface, 'pointermove', e => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag = { x: e.clientX, y: e.clientY };
      // dragging pulls the view, as on a touch screen
      this.pose.yaw -= dx * 0.0045;
      this.pose.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pose.pitch + dy * 0.0045));
    });
    const end = (e: PointerEvent) => { this.drag = null; if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId); };
    on(surface, 'pointerup', end); on(surface, 'pointercancel', end);
  }

  /** Walks the player to a station. `announce` hands keyboard focus to its screen. */
  goTo(id: StationId, announce = false) {
    const station = STATIONS.find(s => s.id === id)!;
    this.moveTo(poseFacing(station.angleDeg));
    if (announce) this.opts.onStation?.(id);
  }

  lookAtWindow() { this.moveTo(poseFacing(-90, 1.6)); }

  private moveTo(to: Pose) {
    this.keys.clear();
    if (this.opts.reducedMotion) { this.pose = to; this.glide = null; return; }
    const from = { ...this.pose };
    this.glide = { from, to: { ...to, yaw: from.yaw + shortestTurn(from.yaw, to.yaw) }, t: 0 };
  }

  setReducedMotion(v: boolean) { this.opts.reducedMotion = v; }

  update(dt: number) {
    if (this.glide) {
      const g = this.glide; g.t = Math.min(1, g.t + dt / 0.55);
      const k = g.t * g.t * (3 - 2 * g.t);
      const mix = (a: number, b: number) => a + (b - a) * k;
      this.pose = { x: mix(g.from.x, g.to.x), z: mix(g.from.z, g.to.z), yaw: mix(g.from.yaw, g.to.yaw), pitch: mix(g.from.pitch, g.to.pitch) };
      if (g.t >= 1) this.glide = null;
      return;
    }
    const has = (...codes: string[]) => codes.some(c => this.keys.has(c));
    const forward = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
    const strafe = (has('KeyD') ? 1 : 0) - (has('KeyA') ? 1 : 0);
    const turn = (has('ArrowRight') ? 1 : 0) - (has('ArrowLeft') ? 1 : 0);   // arrows turn, A and D sidestep
    if (turn) this.pose.yaw += turn * 1.9 * dt;
    this.pose = walk(this.pose, forward, strafe, dt);
  }

  dispose() { for (const f of this.off) f(); this.off = []; this.keys.clear(); }
}
