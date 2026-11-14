/**
 * The astronaut's movement and the third-person camera that follows it. The pure helpers at the
 * top hold the rules (walls, obstacles, where to stand, what is in reach) and are what the tests
 * cover; the ThirdPerson class wires them to the keyboard and mouse.
 */
import { OBSTACLES, ROOM, SCREEN, SEAT, STATIONS, type Box, type Station, type StationId } from './stations';

export interface Vec2 { x: number; z: number }
export interface CameraPose { x: number; y: number; z: number; tx: number; ty: number; tz: number }
export type Mode = { kind: 'walk' } | { kind: 'station'; id: StationId } | { kind: 'seated' };
export type Target = { kind: 'station'; id: StationId; title: string } | { kind: 'seat'; title: string };

const BODY_RADIUS = 0.36;
const WALL_MARGIN = 0.5;
export const START: Vec2 & { heading: number } = { x: 0, z: 1.6, heading: 0 };

/** Signed smallest rotation from one heading to another, radians. */
export function shortestTurn(from: number, to: number): number {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

const inside = (p: Vec2, b: Box) => p.x > b.x0 - BODY_RADIUS && p.x < b.x1 + BODY_RADIUS && p.z > b.z0 - BODY_RADIUS && p.z < b.z1 + BODY_RADIUS;
export const blocked = (p: Vec2, obstacles: readonly Box[] = OBSTACLES) =>
  Math.abs(p.x) > ROOM.halfWidthM - WALL_MARGIN || Math.abs(p.z) > ROOM.halfDepthM - WALL_MARGIN || obstacles.some(b => inside(p, b));

/** Moves by (dx, dz), sliding along walls and furniture instead of stopping dead. */
export function moveInRoom(p: Vec2, dx: number, dz: number, obstacles: readonly Box[] = OBSTACLES): Vec2 {
  let next = { x: p.x + dx, z: p.z + dz };
  if (!blocked(next, obstacles)) return next;
  next = { x: p.x + dx, z: p.z };
  if (!blocked(next, obstacles)) return next;
  next = { x: p.x, z: p.z + dz };
  return blocked(next, obstacles) ? p : next;
}

/** Heading that faces along (dx, dz). Heading 0 looks at the window (negative z). */
export const headingOf = (dx: number, dz: number) => Math.atan2(dx, -dz);

/** Where the astronaut stands to use a wall monitor: in front of it and off to one side, so the camera sees the screen. */
export function standSpot(s: Station): Vec2 & { heading: number } {
  const side = { x: -s.nz, z: s.nx };                       // along the wall
  return { x: s.x + s.nx * 1.2 + side.x * 1.45, z: s.z + s.nz * 1.2 + side.z * 1.45, heading: headingOf(-s.nx, -s.nz) };
}

/** Camera for reading a monitor: square on to the screen. */
export function stationCamera(s: Station): CameraPose {
  return { x: s.x + s.nx * 2.75, y: SCREEN.centreHeightM + 0.05, z: s.z + s.nz * 2.75, tx: s.x, ty: SCREEN.centreHeightM - 0.05, tz: s.z };
}

/** Camera for the pilot seat: over the shoulder, looking out of the window. */
export const SEAT_CAMERA: CameraPose = { x: 1.55, y: 2.25, z: SEAT.z + 2.7, tx: -0.2, ty: 1.45, tz: -ROOM.halfDepthM };

/** Camera that follows the astronaut, kept inside the room. */
export function followCamera(p: Vec2, yaw: number, pitch: number, distance = 3.6): CameraPose {
  const ty = 1.5, reach = distance * Math.cos(pitch);
  const clamp = (v: number, half: number) => Math.max(-half + 0.35, Math.min(half - 0.35, v));
  return {
    x: clamp(p.x - Math.sin(yaw) * reach, ROOM.halfWidthM), z: clamp(p.z + Math.cos(yaw) * reach, ROOM.halfDepthM),
    y: Math.min(ROOM.heightM - 0.3, ty + 0.35 + distance * Math.sin(pitch)), tx: p.x, ty, tz: p.z,
  };
}

/** The monitor or seat the astronaut can use from here, if any is in reach. */
export function inReach(p: Vec2, reachM = 2.3): Target | null {
  let best: Target | null = null, bestD = reachM;
  for (const s of STATIONS) {
    const d = Math.hypot(s.x + s.nx * 1.2 - p.x, s.z + s.nz * 1.2 - p.z);
    if (d < bestD) { best = { kind: 'station', id: s.id, title: s.title }; bestD = d; }
  }
  const seat = Math.hypot(SEAT.x - p.x, SEAT.z - p.z);
  if (seat < Math.min(bestD, 1.7)) best = { kind: 'seat', title: SEAT.title };
  return best;
}

const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
const PITCH = { min: 0.05, max: 0.7 };

export interface ThirdPersonOptions {
  reducedMotion: boolean;
  /** The mode changed: walking, using a monitor, or seated. */
  onMode?: (mode: Mode) => void;
  /** What "E" would use right now changed (null: nothing in reach). */
  onTarget?: (target: Target | null) => void;
}

export class ThirdPerson {
  pos: Vec2 = { x: START.x, z: START.z };
  heading = START.heading;
  /** 0..1, for the walk animation. */
  speed = 0;
  mode: Mode = { kind: 'walk' };
  camera: CameraPose;
  private yaw = 0;
  private pitch = 0.3;
  private keys = new Set<string>();
  private drag: { x: number; y: number } | null = null;
  private off: Array<() => void> = [];
  private target: Target | null = null;

  constructor(surface: HTMLElement, private opts: ThirdPersonOptions) {
    this.camera = followCamera(this.pos, this.yaw, this.pitch);
    const on = <K extends keyof WindowEventMap>(el: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener); this.off.push(() => el.removeEventListener(type, fn as EventListener));
    };
    on(window, 'keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Escape') { if (isField(e.target)) (e.target as HTMLElement).blur(); this.walk(); return; }
      if (isField(e.target)) return;                         // typing and menu keys belong to the field
      const station = STATIONS.find(s => s.key === e.key);
      if (station) { this.use(station.id); e.preventDefault(); return; }
      if (e.key === SEAT.key) { this.sit(); e.preventDefault(); return; }
      if (e.code === 'KeyE') { this.interact(); e.preventDefault(); return; }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) {
        if ((e.target as HTMLElement)?.tagName === 'BUTTON') (e.target as HTMLElement).blur();
        this.keys.add(e.code); e.preventDefault();
        if (this.mode.kind === 'station' && /^(Key[WASD]|Arrow(Up|Down))$/.test(e.code)) this.walk();   // walking away leaves the monitor
      }
    });
    on(window, 'keyup', e => this.keys.delete(e.code));
    on(window, 'blur', () => { this.keys.clear(); this.drag = null; });
    on(surface, 'pointerdown', e => {
      const t = e.target as HTMLElement;
      if (e.button !== 0 || t.closest('.monitor-screen, .cabin-overlay')) return;
      this.drag = { x: e.clientX, y: e.clientY }; surface.setPointerCapture(e.pointerId);
    });
    on(surface, 'pointermove', e => {
      if (!this.drag || this.mode.kind !== 'walk') return;
      this.yaw += (e.clientX - this.drag.x) * 0.006;
      this.pitch = Math.max(PITCH.min, Math.min(PITCH.max, this.pitch + (e.clientY - this.drag.y) * 0.004));
      this.drag = { x: e.clientX, y: e.clientY };
    });
    const end = (e: PointerEvent) => { this.drag = null; if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId); };
    on(surface, 'pointerup', end); on(surface, 'pointercancel', end);
  }

  private setMode(mode: Mode) { this.mode = mode; this.keys.clear(); this.opts.onMode?.(mode); }

  /** Uses whatever is in reach; from a monitor or the seat, steps back to walking. */
  interact() {
    if (this.mode.kind !== 'walk') { this.walk(); return; }
    const t = inReach(this.pos);
    if (t?.kind === 'station') this.use(t.id); else if (t?.kind === 'seat') this.sit();
  }

  /** Walks the astronaut to a monitor and turns the camera to read it. */
  use(id: StationId) {
    const spot = standSpot(STATIONS.find(s => s.id === id)!);
    this.pos = { x: spot.x, z: spot.z }; this.heading = spot.heading;
    this.setMode({ kind: 'station', id });
  }

  sit() { this.pos = { x: SEAT.x, z: SEAT.z }; this.heading = SEAT.heading; this.setMode({ kind: 'seated' }); }

  /** Back to walking. From the seat the astronaut stands up beside it. */
  walk() {
    if (this.mode.kind === 'walk') return;
    if (this.mode.kind === 'seated') { this.pos = { x: SEAT.x + 0.95, z: SEAT.z + 0.75 }; this.yaw = 0; }
    else this.yaw = this.heading;                            // keep looking the way the astronaut faces
    this.setMode({ kind: 'walk' });
  }

  setReducedMotion(v: boolean) { this.opts.reducedMotion = v; }

  update(dt: number) {
    let want: CameraPose;
    this.speed = 0;
    if (this.mode.kind === 'station') want = stationCamera(STATIONS.find(s => s.id === (this.mode as { id: StationId }).id)!);
    else if (this.mode.kind === 'seated') want = SEAT_CAMERA;
    else {
      const has = (...c: string[]) => c.some(k => this.keys.has(k));
      const turn = (has('ArrowRight') ? 1 : 0) - (has('ArrowLeft') ? 1 : 0);
      this.yaw += turn * 1.8 * dt;
      const f = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0), s = (has('KeyD') ? 1 : 0) - (has('KeyA') ? 1 : 0);
      if (f || s) {
        // movement is relative to where the camera looks; the astronaut turns to face it
        const n = Math.hypot(f, s), dx = (Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) / n, dz = (-Math.cos(this.yaw) * f + Math.sin(this.yaw) * s) / n;
        this.pos = moveInRoom(this.pos, dx * 3.1 * dt, dz * 3.1 * dt);
        this.heading += shortestTurn(this.heading, headingOf(dx, dz)) * Math.min(1, dt * 12);
        this.speed = 1;
      }
      want = followCamera(this.pos, this.yaw, this.pitch);
      const t = inReach(this.pos);
      if (t?.kind !== this.target?.kind || (t?.kind === 'station' && this.target?.kind === 'station' && t.id !== this.target.id)) { this.target = t; this.opts.onTarget?.(t); }
    }
    if (this.mode.kind !== 'walk' && this.target) { this.target = null; this.opts.onTarget?.(null); }
    const k = this.opts.reducedMotion ? 1 : Math.min(1, dt * (this.mode.kind === 'walk' ? 9 : 4.5));
    const c = this.camera;
    this.camera = { x: c.x + (want.x - c.x) * k, y: c.y + (want.y - c.y) * k, z: c.z + (want.z - c.z) * k,
      tx: c.tx + (want.tx - c.tx) * k, ty: c.ty + (want.ty - c.ty) * k, tz: c.tz + (want.tz - c.tz) * k };
  }

  dispose() { for (const f of this.off) f(); this.off = []; this.keys.clear(); }
}
