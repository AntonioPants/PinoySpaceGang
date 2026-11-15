import { openingCameraPose } from '../../web/src/components/cutscene/cameraHandoff';
/**
 * Live 3D view of a flight flown by the physics engine in app/sim.
 * Each frame it advances the simulation and draws the true state: position, tilt, throttle,
 * hazard scan, divert, trail. When the flight ends it hands over to the cutscene ending.
 */
import * as THREE from "three";
import { CutsceneEngine, peekOpeningHandoff, V, lerp, clamp01, TAIL, type Track, type OpeningHandoff } from "../../web/src/components/cutscene/engine";
import type { Controls, FlightSummary, Sim, SimEvent, TelemetrySample } from "../sim/src/index.ts";
import { buildOverlay, buildSiteMarker, OVERLAY_STYLE, overlayStep, type OverlayStyle, type SensorOverlay } from "./sensorOverlay.ts";
import { buildLander, type LanderSpec } from "../../web/src/components/cutscene/lander";

export type CamMode = "auto" | "chase" | "orbit" | "ground" | "top";

export interface FlightSetup {
  target: { x: number; y: number };
  refElevation: number;                 // terrain elevation at the target, metres
  gravity: number; airDensity: number;
  wind: { x: number; y: number };
  dust: number;                         // 0..1 interference setting
  /**
   * Autopilot hazard scan: true when the autopilot flies with a sensor that maps the ground. The
   * scan is drawn when the sim reports it (the siteSelected event), over divertRadiusM round the
   * point it scanned; in manual flight the player's overlay appears below scanAltitudeM.
   */
  hazardScan: boolean; scanAltitudeM: number; divertRadiusM: number;
  legRadiusM: number; maxSlopeDeg: number; maxRoughnessM: number;
  /** Manual flight, when the flight is driven from outside (no controls hook): shows the player's scan overlay. */
  manual?: boolean;
}

export interface FlightHooks {
  controls?: (dtSim: number) => Controls | undefined;   // manual flight
  onEvent?: (e: SimEvent) => void;
  onEnd?: (s: FlightSummary) => void;
}

const TRAIL_MAX = 6000;

export class FlightView extends CutsceneEngine {
  sim: Sim | null = null;
  speed = 1;
  paused = false;
  camMode: CamMode = "auto";
  private setup!: FlightSetup;
  private hooks: FlightHooks = {};
  private seen = 0;
  private aim = { x: 0, y: 0 };
  private lastVel = V();
  private scanned = false;
  private scanT = -1;
  private idleStart = V(0, 1000, 0);
  az = 0; el = 0; zoom = 1;               // user look-around: drag and scroll
  idleClock = 0;                          // keeps the idle orbit continuous across slider changes
  private cam = { az: 0.9, el: 0.3, dist: 34, lead: V(), vAz: 0, vEl: 0, vDist: 0, vLead: V() };   // camera orbit round the lander, on springs
  private chaseAz = 0.9;
  private cut = true;                     // next frame places the camera without easing
  private openingCamera: OpeningHandoff | null = null;
  private openingCameraAge = 0;
  externallyDriven = false;
  private simAcc = 0;                     // simulated time not yet stepped, s
  private path: THREE.Line; private trail: THREE.Line; private trailN = 0; private trailT = -1;
  private overlay: SensorOverlay | null = null;
  private scanCentre = V();               // scene point the current scan is centred on
  private scanFrom: { x: number; y: number } | null = null;   // aim the autopilot scanned round, before any divert
  private siteChosen = false;             // the autopilot has picked its landing spot: show the marker
  private marker = buildSiteMarker();
  private cone: THREE.Mesh; private divert: THREE.Line | null = null;
  /** Manual flight: show the hazard sensor's scan overlay (the player's toggle). */
  scanOverlay = true;
  private comparisonFlight: Sim | null = null;
  private comparisonTime = 0;
  private comparisonLander: THREE.Group | null = null;
  private comparisonTrail: THREE.Line | null = null;

  constructor(...args: ConstructorParameters<typeof CutsceneEngine>) {
    super(...args);
    this.path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x7fdcff, dashSize: 14, gapSize: 9, fog: false, transparent: true, opacity: 0.9 }));
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3)); tg.setDrawRange(0, 0);
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffd27a, fog: false, transparent: true, opacity: 0.85 }));
    this.trail.frustumCulled = this.path.frustumCulled = false;
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.cone.geometry.translate(0, -0.5, 0);                    // apex at the origin, opening downwards
    this.cone.visible = false;
    this.scene.add(this.path, this.trail, this.cone, this.marker.group);
    const el = this.renderer.domElement;
    let drag: { x: number; y: number } | null = null;
    el.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => { if (!drag) return; this.az += (e.clientX - drag.x) * 0.006; this.el = Math.max(-0.5, Math.min(1.1, this.el + (e.clientY - drag.y) * 0.004)); drag = { x: e.clientX, y: e.clientY }; });
    el.addEventListener("pointerup", () => { drag = null; });
    el.addEventListener("wheel", (e) => { e.preventDefault(); this.zoom = Math.max(0.35, Math.min(5, this.zoom * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  }

  /** Attach a render-only terrain reference; it never enters the simulator. Caller owns removal. */
  addComparisonSurface(surface: THREE.Group) { this.scene.add(surface); }

  /** A separate autonomous planetary run; it never supplies the mission outcome. */
  setComparisonFlight(flight: Sim | null, equipment?: LanderSpec) {
    if (this.comparisonLander) {
      this.scene.remove(this.comparisonLander);
      this.comparisonLander.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    }
    if (this.comparisonTrail) { this.scene.remove(this.comparisonTrail); this.comparisonTrail.geometry.dispose(); (this.comparisonTrail.material as THREE.Material).dispose(); }
    this.comparisonFlight = flight; this.comparisonTime = 0; this.comparisonLander = null; this.comparisonTrail = null;
    if (!flight) return;
    const lander = buildLander(equipment); lander.flame.visible = false;
    lander.group.traverse(o => { if (o instanceof THREE.Mesh) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      o.material = new THREE.MeshBasicMaterial({color:0x65e7ff,transparent:true,opacity:.55,depthWrite:false,wireframe:true});
    } });
    this.comparisonLander = lander.group; this.scene.add(lander.group);
    this.comparisonTrail = new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x65e7ff,transparent:true,opacity:.8,depthWrite:false}));
    this.comparisonTrail.frustumCulled=false; this.scene.add(this.comparisonTrail);
  }

  /** Sim coordinates (x east, y north, z elevation) -> scene (x east, y up, z south), target at the origin. */
  toScene(x: number, y: number, z: number) { return V(x - this.setup.target.x, z - this.setup.refElevation, -(y - this.setup.target.y)); }

  private applySetup(s: FlightSetup) {
    this.setup = s; this.gravity = s.gravity; this.air = s.airDensity;
    this.wind.set(s.wind.x, 0, -s.wind.y); this.dustLevel = 0.7 + 1.6 * s.dust;
    this.aim = { ...s.target };
  }

  /** Before launch: the lander waits at the start point and the predicted path is drawn. */
  showIdle(s: FlightSetup, start: { x: number; y: number; z: number }, prediction?: TelemetrySample[]) {
    this.applySetup(s); this.finish?.(); this.resetScene(); this.clearFlightVisuals();
    this.sim = null; this.kind = "live"; this.t = 0; this.cut = this.camPos.lengthSq() < 1e4;   // a fresh scene cuts, a running one eases
    const sx = start.x - s.target.x, sz = -(start.y - s.target.y);
    this.idleStart.set(sx, this.terrain.heightAt(sx, sz) + start.z, sz);
    this.setPrediction(prediction);
    cancelAnimationFrame(this.raf); this.last = performance.now(); this.raf = requestAnimationFrame(this.tick);
  }

  setPrediction(samples?: TelemetrySample[]) {
    const pts = (samples ?? []).filter((_, i, a) => i % 3 === 0 || i === a.length - 1).map((p) => this.toScene(p.x, p.y, p.z));
    this.path.geometry.dispose(); this.path.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.path.computeLineDistances(); this.path.visible = pts.length > 1;
  }

  /** Flies `sim` live. The same seed and settings as the prediction give the same flight. */
  fly(sim: Sim, s: FlightSetup, hooks: FlightHooks = {}) {
    this.applySetup(s); this.finish?.(); this.resetScene(); this.clearFlightVisuals();
    this.openingCamera=peekOpeningHandoff();this.openingCameraAge=0;
    this.audio.start();this.beginHandoff();
    this.sim = sim; this.hooks = hooks; this.seen = 0; this.scanned = false; this.scanT = -1;
    this.kind = "live"; this.t = 0; this.camEase = 0; this.track = null; this.cut = true; this.simAcc = 0;
    this.ui.fade.style.opacity = "0";
    cancelAnimationFrame(this.raf); this.last = performance.now(); this.raf = requestAnimationFrame(this.tick);
  }

  /** Test hook: run `frames` fixed steps without waiting for the browser, draw once, and stop. */
  settle(frames: number, dt = 1 / 30) {
    cancelAnimationFrame(this.raf);
    for (let i = 0; i < frames; i++) this.step(dt);
    const redraw = () => { this.render(); this.raf = requestAnimationFrame(redraw); };     // keep drawing, stop simulating
    redraw();
  }

  /** Test hook: flies the rest of the flight at 60 fps and reports how steadily the camera moved. */
  cameraStats(speed: number) {
    cancelAnimationFrame(this.raf); this.speed = speed;
    let prev = this.camPos.clone(), prevV = V(), maxJerk = 0, maxOff = 0, maxTurn = 0, n = 0, at = ""; const fwd0 = V();
    for (let i = 0; i < 20000 && (this.kind === "live" || this.t < 4); i++) {
      this.step(1 / 60); n++;
      const v = this.camPos.clone().sub(prev).multiplyScalar(60), fwd = this.camLook.clone().sub(this.camPos).normalize();
      const toL = this.lander.group.position.clone().sub(this.camPos).normalize();
      const acc = v.clone().sub(prevV).length() * 60; if (i > 2 && acc > maxJerk) at = `${this.kind} t=${(this.sim?.state.t ?? 0).toFixed(1)} alt=${(this.sim?.state.altitudeAGL ?? 0).toFixed(0)} frame=${i} endT=${this.t.toFixed(2)} v=${prevV.length().toFixed(1)}->${v.length().toFixed(1)}`;
      if (i > 2) { maxJerk = Math.max(maxJerk, acc); maxTurn = Math.max(maxTurn, fwd.angleTo(fwd0) * 60); if (this.lander.group.visible) maxOff = Math.max(maxOff, fwd.angleTo(toL)); }
      prev = this.camPos.clone(); prevV = v; fwd0.copy(fwd);
    }
    return { frames: n, worstAt: at, maxCameraAccel: Math.round(maxJerk), maxTurnRateDegS: Math.round((maxTurn * 180) / Math.PI), maxLanderOffAxisDeg: Math.round((maxOff * 180) / Math.PI) };
  }

  private clearFlightVisuals() {
    this.trailN = 0; this.trailT = -1; this.trail.geometry.setDrawRange(0, 0);
    if (this.overlay) { this.scene.remove(this.overlay.root); this.overlay.dispose(); this.overlay = null; }
    if (this.divert) { this.scene.remove(this.divert); this.divert.geometry.dispose(); (this.divert.material as THREE.Material).dispose(); this.divert = null; }
    this.cone.visible = false; this.marker.group.visible = false; this.siteChosen = false; this.scanFrom = null; this.scanned = false; this.scanT = -1;
  }

  /** How the flying sensor is drawn, and what its overlay shows: for HUDs and tests. */
  get scanStatus(): { style: OverlayStyle; shown: boolean; counts: SensorOverlay["counts"] | null; siteChosen: boolean } {
    const style = this.sim ? OVERLAY_STYLE[this.sim.sensor.id] : "dots";
    return { style, shown: !!this.overlay?.root.visible, counts: this.overlay?.counts ?? null, siteChosen: this.siteChosen };
  }

  protected live(dt: number) {
    const L = this.lander.group, sim = this.sim;
    if (sim) this.aim = { ...sim.aim };                    // where guidance is really aiming
    const aimS = V(this.aim.x - this.setup.target.x, 0, -(this.aim.y - this.setup.target.y)); aimS.y = this.terrain.heightAt(aimS.x, aimS.z);
    // once the autopilot has chosen its spot, the site marker replaces the plain target ring
    this.targetRing.visible = !this.siteChosen; this.targetRing.position.set(aimS.x, aimS.y + 0.6, aimS.z);
    this.targetRing.scale.setScalar(Math.max(3.5, Math.min(70, this.camPos.distanceTo(aimS) * 0.035)) * (1 + 0.1 * Math.sin(this.t * 5)));

    if (!sim) {                                             // idle overview
      L.visible = true; L.position.copy(this.idleStart); this.orient(V(1, 0, 0), 0); this.thrust(0, dt);
      if(!this.paused)this.idleClock += dt;
      const mid = this.idleStart.clone().multiplyScalar(0.4), r = Math.max(260, this.idleStart.length() * 1.05) * this.zoom;
      const a = this.idleClock * 0.07 + this.az + 0.9;
      this.camEase = this.cut ? 0 : 2.5; this.cut = false;
      this.setCam(mid.clone().add(V(Math.cos(a) * r, r * (0.42 + this.el * 0.5), Math.sin(a) * r)), mid);
      return;
    }

    // The physics runs in fixed 1/120 s steps. Step it here and keep the remainder, then draw the
    // lander that fraction of a step ahead: otherwise frames carry uneven numbers of steps and the
    // ground stutters past the camera.
    const H = 1 / 120;
    if (!this.paused && !this.externallyDriven) {
      this.simAcc += Math.min(dt, 0.1) * this.speed;
      const controls = this.hooks.controls?.(dt * this.speed);
      while (this.simAcc >= H && !sim.state.done) { sim.step(controls); this.simAcc -= H; }
    }
    while (this.seen < sim.events.length) this.onSimEvent(sim.events[this.seen++]);
    const st = sim.state, ahead = st.done || this.paused ? 0 : Math.min(this.simAcc, H);
    this.comparisonTime = Math.max(this.comparisonTime, st.t);
    this.updateComparison(this.comparisonTime);
    /* The comparison may continue during the real flight's ending. */
    const P = this.toScene(st.position.x + st.velocity.x * ahead, st.position.y + st.velocity.y * ahead, st.position.z + st.velocity.z * ahead);
    // near the ground follow the drawn surface, which carries about a metre of added detail
    const drawn = this.terrain.heightAt(P.x, P.z), w = clamp01(1 - st.altitudeAGL / 60);
    P.y = lerp(P.y, drawn + st.altitudeAGL, w);
    L.visible = true; L.position.copy(P);
    const lean = V(Math.tan(st.tiltX), 0, -Math.tan(st.tiltY)), ang = Math.atan(lean.length());   // the true attitude
    this.orient(lean.lengthSq() > 1e-9 ? lean.clone().normalize() : V(1, 0, 0), ang);
    this.thrust(this.paused ? 0 : st.throttle, dt);
    this.trauma = Math.max(this.trauma, 0.14 * st.throttle * clamp01(1 - st.altitudeAGL / 120));
    if (!st.done) this.lastVel.set(st.velocity.x, st.velocity.z, -st.velocity.y);

    if (st.t - this.trailT > 0.2 && this.trailN < TRAIL_MAX) {
      const a = this.trail.geometry.attributes.position as THREE.BufferAttribute;
      a.setXYZ(this.trailN++, P.x, P.y + 1.5, P.z); a.needsUpdate = true; this.trail.geometry.setDrawRange(0, this.trailN); this.trailT = st.t;
    }
    // The autopilot's scan is drawn when the sim reports it (onSimEvent). In manual flight the
    // player's overlay comes up inside the sensor's scan height, round the target, on their toggle.
    const manual = this.setup.manual ?? !!this.hooks.controls;
    if (manual && sim.sensor.profile.map && !this.scanned && this.scanOverlay && st.altitudeAGL <= this.setup.scanAltitudeM) {
      this.scanned = true; this.startScan(sim.aim);
    }
    if (this.overlay && manual) this.overlay.root.visible = this.scanOverlay;
    this.updateScan(P);
    if (this.siteChosen) {
      this.marker.group.visible = true;
      this.marker.place(V(aimS.x, aimS.y + 0.5, aimS.z), this.camPos.distanceTo(aimS), this.t);
    }
    // On the frame the flight ends the lander stops dead. The camera must not stop with it: it
    // lets go and coasts on its spring into the ending shot.
    if (st.done) this.enterEnding(P, lean, ang); else this.liveCamera(P, aimS, st.altitudeAGL, dt);
  }

  protected step(dt: number) {
    const wasEnding=this.kind === 'ending';
    super.step(dt);
    if (wasEnding && !this.paused && this.comparisonFlight && !this.comparisonFlight.state.done) {
      this.comparisonTime += dt * this.speed;
      this.updateComparison(this.comparisonTime);
    }
  }

  private updateComparison(time: number) {
    const ghost=this.comparisonFlight;
    if (ghost && this.comparisonLander && this.comparisonTrail) {
      while (!ghost.state.done && ghost.state.t + 1/120 <= time + 1e-9) ghost.step();
      const p=ghost.state.position;
      const bounds=ghost.terrain.grid.bounds();
      this.comparisonLander.visible=p.x>=bounds.minX && p.x<=bounds.maxX && p.y>=bounds.minY && p.y<=bounds.maxY;
      this.comparisonLander.position.copy(this.toScene(p.x,p.y,p.z));
      this.comparisonLander.rotation.set(ghost.state.tiltY,0,ghost.state.tiltX);
      const points=ghost.telemetry().samples.map(s=>this.toScene(s.x,s.y,s.z));
      this.comparisonTrail.geometry.dispose(); this.comparisonTrail.geometry=new THREE.BufferGeometry().setFromPoints(points);
    }
  }

  private onSimEvent(e: SimEvent) {
    // The autopilot scans round its aim, may divert, then reports the site it settled on.
    if (e.type === "hazardDetected") this.scanFrom = { ...e.at };
    if (e.type === "siteSelected") {
      if (this.setup.hazardScan && !this.scanned) { this.scanned = true; this.startScan(this.scanFrom ?? e.at); }
      this.siteChosen = true; this.scanFrom = null;
    }
    if (e.type === "divert") {
      const a = this.toScene(e.from.x, e.from.y, 0), b = this.toScene(e.to.x, e.to.y, 0);
      a.y = this.terrain.heightAt(a.x, a.z) + 1; b.y = this.terrain.heightAt(b.x, b.z) + 1;
      this.divert = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 0xffd23a, fog: false }));
      this.scene.add(this.divert); this.aim = { ...e.to }; this.audio.beep(660);
    }
    if (e.type === "fuelLow") this.audio.beep(440);
    this.hooks.onEvent?.(e);
  }

  /**
   * Draw what the sensor saw over the divert radius round `centre` (sim coordinates). The cells
   * are the sim's own classification of the sensor's view (Sim.hazardMap); the look is the
   * sensor's (sensorOverlay.ts). Sensors with no map, and the crew window, draw nothing.
   */
  private startScan(centre: { x: number; y: number }) {
    const s = this.setup, sim = this.sim!, style = OVERLAY_STYLE[sim.sensor.id];
    if (style === "none") return;
    const step = overlayStep(style, s.divertRadiusM, sim.sensor.profile.cellM);
    const cells = sim.hazardMap(centre, s.divertRadiusM, step);
    this.overlay = buildOverlay(style, {
      cells, step, center: { ...centre }, radiusM: s.divertRadiusM, quality: sim.sensor.quality,
      place: (x, y, lift) => { const p = this.toScene(x, y, 0); p.y = this.terrain.heightAt(p.x, p.z) + lift; return p; },
    });
    this.scene.add(this.overlay.root); this.scanT = 0;
    this.scanCentre = this.toScene(centre.x, centre.y, 0); this.scanCentre.y = this.terrain.heightAt(this.scanCentre.x, this.scanCentre.z);
    const pulse = style === "raster" ? 0xe6fbff : style === "outline" ? 0xffffff : style === "drape" ? 0x3fc8ff : 0x7fdcff;
    this.addRing(this.scanCentre.clone().add(V(0, 0.8, 0)), pulse, 2, s.divertRadiusM, style === "raster" ? 0.7 : 1.5, false);
    this.audio.beep(style === "raster" ? 1760 : 1320);
  }

  private updateScan(P: THREE.Vector3) {
    if (!this.overlay || this.scanT < 0) return;
    this.scanT += this.frameDt;
    this.overlay.update(this.scanT);
    const u = clamp01(this.scanT / 1.5), centre = this.scanCentre;
    // the beam from the lander to the ground while the scan runs (not for the camera's outlines)
    this.cone.visible = this.scanT < 2.2 && this.overlay.style !== "outline" && this.overlay.root.visible;
    if (this.cone.visible) {
      const axis = P.clone().sub(centre), h = axis.length();
      this.cone.position.copy(P); this.cone.scale.set(this.setup.divertRadiusM * u, h, this.setup.divertRadiusM * u);
      this.cone.quaternion.setFromUnitVectors(V(0, 1, 0), axis.normalize());
      (this.cone.material as THREE.MeshBasicMaterial).opacity = 0.07 * clamp01(2.2 - this.scanT);
    }
  }

  /**
   * The camera rides with the lander: its position is the lander's plus an offset given by an
   * azimuth, an elevation and a distance. Only those three ease, so the lander stays put in the
   * frame at any speed and a change of mode is a turn, never a jump.
   */
  private liveCamera(P: THREE.Vector3, aimS: THREE.Vector3, alt: number, dt: number) {
    const mode = this.camMode === "auto" ? (alt > 160 ? "chase" : alt > 40 ? "orbit" : "ground") : this.camMode;
    const c = this.cam, vh = Math.hypot(this.lastVel.x, this.lastVel.z);
    // behind the direction of travel; held while slow, so a hover does not spin the view
    if (vh > 6) this.chaseAz = Math.atan2(-this.lastVel.z, -this.lastVel.x);
    else if (this.cut) { const d = V(P.x - aimS.x, 0, P.z - aimS.z); if (d.lengthSq() > 4) this.chaseAz = Math.atan2(d.z, d.x); }
    let az = c.az, el = 0.3, dist = 34, lead = 0;
    if (mode === "chase") { az = this.chaseAz; el = 0.32; dist = 34; lead = 0.1; }
    else if (mode === "orbit") { az = c.az + 0.25; el = 0.14; dist = 36; }      // target kept ahead: a steady slow turn
    else if (mode === "ground") { az = c.az + 0.1; el = 0.04; dist = 30; }
    else { el = 1.25; dist = Math.max(90, alt * 0.8); lead = 0.25; }
    el = Math.max(-0.2, Math.min(1.4, el + this.el)); dist *= this.zoom;
    // look a little ahead towards the aim point, but never so far that the lander leaves the frame
    const want = aimS.clone().sub(P).multiplyScalar(lead), maxLead = dist * 0.2; if (want.length() > maxLead) want.setLength(maxLead);
    if (this.cut) { c.az = az; c.el = el; c.dist = dist; c.lead.copy(want); c.vAz = c.vEl = c.vDist = 0; c.vLead.set(0, 0, 0); this.cut = false; }
    else {
      // critically damped springs: no sudden change of speed when the target or the mode changes
      const W = 2.4, damp = 1 / (1 + 2 * W * dt);
      const turn = Math.atan2(Math.sin(az - c.az), Math.cos(az - c.az));                               // shortest way round
      c.vAz = (c.vAz + turn * W * W * dt) * damp; c.az += c.vAz * dt;
      c.vEl = (c.vEl + (el - c.el) * W * W * dt) * damp; c.el += c.vEl * dt;
      c.vDist = (c.vDist + (dist - c.dist) * W * W * dt) * damp; c.dist += c.vDist * dt;
      c.vLead.addScaledVector(want.clone().sub(c.lead), W * W * dt).multiplyScalar(damp); c.lead.addScaledVector(c.vLead, dt);
    }
    const a = c.az + this.az;
    this.camEase = 0;
    const position=P.clone().add(V(Math.cos(a)*Math.cos(c.el),Math.sin(c.el),Math.sin(a)*Math.cos(c.el)).multiplyScalar(c.dist));
    const look=P.clone().add(V(0,1.5,0)).add(c.lead);
    if(this.openingCamera){
      const pose=openingCameraPose(P,position,look,this.openingCamera,this.openingCameraAge);
      position.copy(pose.position);look.copy(pose.look);
      this.openingCameraAge+=dt;if(this.openingCameraAge>=.9)this.openingCamera=null;
    }
    this.setCam(position,look);
  }

  /** The flight is over: stage the cutscene ending at the real touchdown point. */
  private enterEnding(P: THREE.Vector3, lean: THREE.Vector3, tilt: number) {
    const sum = this.sim!.telemetry().summary!;
    const at = V(P.x, this.terrain.heightAt(P.x, P.z), P.z), push = V(this.lastVel.x, 0, this.lastVel.z);
    const hold = sum.outcome === "timeout" ? P : at, dir = lean.lengthSq() > 1e-9 ? lean.clone().normalize() : V(1, 0, 0);
    const tr: Track = { t: [0, 0.01], pos: [hold.clone(), hold.clone()], throttle: [0, 0], tilt: [tilt, tilt], lean: [dir, dir], duration: 0,
      outcome: sum.outcome, impact: Math.hypot(sum.verticalSpeedMps, sum.horizontalSpeedMps), sink: sum.verticalSpeedMps,
      survivability: sum.survivability, reason: sum.failureReasons[0], push, endTilt: tilt, endLean: dir };
    this.stageEnding(at, push);
    const off = this.camPos.clone().sub(at);
    this.cam0 = { ang: Math.atan2(off.z, off.x), r: Math.max(22, Math.min(60, Math.hypot(off.x, off.z))) };
    this.track = tr; this.kind = "ending"; this.t = 0; this.duration = TAIL[sum.outcome]; this.camEase = 1.6;
    const cx = at.x + Math.cos(this.cam0.ang) * this.cam0.r, cz = at.z + Math.sin(this.cam0.ang) * this.cam0.r;
    this.setCam(V(cx, this.terrain.heightAt(cx, cz) + 2.4, cz), hold.clone().add(V(0, 2, 0)));
    this.hooks.onEnd?.(sum);
  }
}
