/**
 * Flight Lab: every setting is a slider, the physics engine in app/sim predicts the flight as you
 * move them, and Launch flies the same flight live in 3D over the real terrain pack.
 */
import { FlightView, type CamMode, type FlightSetup } from "./view";
import { simToPack, type TerrainPack } from "../../web/src/components/cutscene/terrainPack";
import type { Boulder } from "../../web/src/components/cutscene/terrain";
import { createTerrainData } from "./pack/load-terrain.mjs";
import { MANIFEST, F32_B64 } from "./terrain-data";
import {
  autopilot, createManualPilot, createSim, GridTerrain, keysToPilotInput, terrainPackToSite, DEFAULT_LANDER,
} from "../sim/src/index.ts";
import type { FlightSummary, FlightTelemetry, Sim, SimEvent, SimInput, SiteTerrain } from "../sim/src/index.ts";

// ------------------------------------------------------------------ settings

interface Slider { key: string; label: string; min: number; max: number; step: number; value: number; unit: string; group: string; terrain?: boolean; }
const SLIDERS: Slider[] = [
  { group: "Vehicle", key: "dryMass", label: "Dry mass", min: 2000, max: 15000, step: 100, value: 7000, unit: "kg" },
  { group: "Vehicle", key: "fuel", label: "Fuel", min: 100, max: 4000, step: 10, value: 1500, unit: "kg" },
  { group: "Vehicle", key: "thrust", label: "Max thrust", min: 5, max: 100, step: 0.5, value: 45, unit: "kN" },
  { group: "Vehicle", key: "isp", label: "Specific impulse", min: 200, max: 450, step: 1, value: 311, unit: "s" },
  { group: "Vehicle", key: "gimbal", label: "Gimbal rate", min: 5, max: 40, step: 1, value: 20, unit: "°/s" },
  { group: "Environment", key: "gravity", label: "Gravity", min: 0.5, max: 12, step: 0.01, value: 1.62, unit: "m/s²" },
  { group: "Environment", key: "air", label: "Air density", min: 0, max: 1.3, step: 0.005, value: 0, unit: "kg/m³" },
  { group: "Environment", key: "windSpeed", label: "Wind speed", min: 0, max: 25, step: 0.5, value: 0, unit: "m/s" },
  { group: "Environment", key: "windDir", label: "Wind blows towards", min: 0, max: 355, step: 5, value: 90, unit: "°" },
  { group: "Approach", key: "altitude", label: "Start altitude", min: 100, max: 3000, step: 10, value: 1000, unit: "m" },
  { group: "Approach", key: "distance", label: "Distance to target", min: 0, max: 2000, step: 10, value: 400, unit: "m" },
  { group: "Approach", key: "heading", label: "Flight heading", min: 0, max: 355, step: 5, value: 90, unit: "°" },
  { group: "Approach", key: "groundSpeed", label: "Ground speed", min: 0, max: 80, step: 1, value: 25, unit: "m/s" },
  { group: "Approach", key: "descent", label: "Descent rate", min: 0, max: 60, step: 1, value: 20, unit: "m/s" },
  { group: "Landing target", key: "east", label: "East of centre", min: -2100, max: 2100, step: 10, value: 0, unit: "m", terrain: true },
  { group: "Landing target", key: "north", label: "North of centre", min: -2100, max: 2100, step: 10, value: 0, unit: "m", terrain: true },
  { group: "Landing target", key: "boulders", label: "Test boulders (synthetic)", min: 0, max: 120, step: 5, value: 0, unit: "", terrain: true },
  { group: "Guidance", key: "dust", label: "Dust interference", min: 0, max: 1, step: 0.05, value: 0, unit: "" },
  { group: "Guidance", key: "glare", label: "Glare interference", min: 0, max: 1, step: 0.05, value: 0, unit: "" },
  { group: "Guidance", key: "scanAlt", label: "Hazard scan altitude", min: 50, max: 500, step: 10, value: 250, unit: "m" },
  { group: "Guidance", key: "divertR", label: "Divert radius", min: 20, max: 300, step: 5, value: 120, unit: "m" },
  { group: "Guidance", key: "termAlt", label: "Terminal gate", min: 5, max: 40, step: 1, value: 15, unit: "m" },
  { group: "Guidance", key: "termRate", label: "Terminal sink rate", min: 0.3, max: 3, step: 0.1, value: 1, unit: "m/s" },
  { group: "Guidance", key: "maxTilt", label: "Max guidance tilt", min: 5, max: 45, step: 1, value: 25, unit: "°" },
  { group: "Touchdown limits", key: "limSink", label: "Max sink rate", min: 1, max: 6, step: 0.1, value: 3, unit: "m/s" },
  { group: "Touchdown limits", key: "limLat", label: "Max lateral speed", min: 0.5, max: 4, step: 0.1, value: 1.2, unit: "m/s" },
  { group: "Touchdown limits", key: "limSlope", label: "Max ground slope", min: 5, max: 25, step: 1, value: 12, unit: "°" },
];
const cfg: Record<string, number> = Object.fromEntries(SLIDERS.map((s) => [s.key, s.value]));
const opt = { strategy: "autonomous" as "autonomous" | "manual", hazard: "lidar" as "lidar" | "camera" | "none", velocimeter: true, seed: 1, intro: false };

const SCENARIOS: Record<string, { label: string; set: Record<string, number>; opt?: Partial<typeof opt> }> = {
  nominal: { label: "Nominal", set: {} },
  lowFuel: { label: "Fuel critical", set: { fuel: 430 } },
  rim: { label: "Crater wall", set: { east: -700, north: -150 }, opt: { hazard: "none" } },
  rimScan: { label: "Wall + lidar divert", set: { east: -640, north: -150, divertR: 200 } },
  boulders: { label: "Boulder field", set: { boulders: 80 } },
  glare: { label: "Boulders + camera glare", set: { boulders: 80, glare: 1 }, opt: { hazard: "camera" } },
  weak: { label: "Underpowered engine", set: { thrust: 14.5 } },
  earth: { label: "Earth gravity + wind", set: { gravity: 9.81, air: 1.225, windSpeed: 12, thrust: 100, fuel: 4000 } },
};

// ------------------------------------------------------------------- terrain

const q = new URLSearchParams(location.search);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const f32 = Uint8Array.from(atob(F32_B64), (c) => c.charCodeAt(0)).buffer;
const pack = createTerrainData(MANIFEST, f32) as TerrainPack;
const baseSite = terrainPackToSite(MANIFEST, f32, { analogOf: "moon" });
const baseTerrain = new GridTerrain(baseSite.heightmap);
const ENV = { name: MANIFEST.name as string, subtitle: "Apollo field-training analog site", preset: "desert" as const, look: { dust: [0.78, 0.68, 0.52] as [number, number, number] } };

/** Deterministic test boulders round the target (sim coordinates). They are synthetic, not data. */
function boulderList(): { x: number; y: number; r: number; h: number }[] {
  const out = []; let s = (opt.seed * 2654435761 + 12345) >>> 0;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < cfg.boulders; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 45;
    out.push({ x: cfg.east + Math.cos(a) * d, y: cfg.north + Math.sin(a) * d, r: 1.5 + rand() * 1.5, h: 0.6 + rand() * 1.0 });
  }
  return out;
}

let fineBase: Float32Array | null = null;
const FINE = 2, FINE_N = Math.round((baseSite.heightmap.cols - 1) * baseSite.heightmap.cellSize / FINE) + 1;
/** The site the physics flies on. With test boulders the pack is resampled to 2 m and the rocks are added to it. */
function buildSite(): SiteTerrain {
  const a = (cfg.windDir * Math.PI) / 180, wind = { x: cfg.windSpeed * Math.sin(a), y: cfg.windSpeed * Math.cos(a) };
  const rocks = boulderList();
  if (!rocks.length) return { ...baseSite, wind };
  const half = ((FINE_N - 1) * FINE) / 2;
  if (!fineBase) {
    fineBase = new Float32Array(FINE_N * FINE_N);
    for (let r = 0; r < FINE_N; r++) for (let c = 0; c < FINE_N; c++) fineBase[r * FINE_N + c] = baseTerrain.heightAt(c * FINE - half, r * FINE - half);
  }
  const heights = fineBase.slice();
  for (const b of rocks) {
    const c0 = Math.round((b.x + half) / FINE), r0 = Math.round((b.y + half) / FINE), n = Math.ceil(b.r / FINE) + 1;
    for (let r = r0 - n; r <= r0 + n; r++) for (let c = c0 - n; c <= c0 + n; c++) {
      if (r < 0 || c < 0 || r >= FINE_N || c >= FINE_N) continue;
      const d = Math.hypot(c * FINE - half - b.x, r * FINE - half - b.y) / b.r;
      if (d < 1) heights[r * FINE_N + c] += b.h * (1 - d * d);
    }
  }
  return { ...baseSite, wind, heightmap: { cols: FINE_N, rows: FINE_N, cellSize: FINE, heights } };
}

// ---------------------------------------------------------------- simulation

let site = buildSite();
function startState() {
  const h = (cfg.heading * Math.PI) / 180, dx = Math.sin(h), dy = Math.cos(h);
  return { position: { x: cfg.east - dx * cfg.distance, y: cfg.north - dy * cfg.distance, z: cfg.altitude },
    velocity: { x: dx * cfg.groundSpeed, y: dy * cfg.groundSpeed, z: -cfg.descent } };
}
function simInput(over: Partial<Record<string, number>> = {}): SimInput {
  const c = { ...cfg, ...over } as Record<string, number>;
  return {
    site, strategy: opt.strategy, seed: opt.seed, gravity: c.gravity, atmosphere: c.air,
    lander: { dryMassKg: c.dryMass, fuelKg: c.fuel, maxThrustN: c.thrust * 1000, ispS: c.isp, maxGimbalRateDegS: c.gimbal,
      limits: { maxVerticalMps: c.limSink, maxHorizontalMps: c.limLat, maxSlopeDeg: c.limSlope } },
    sensors: { hazard: opt.hazard, velocimeter: opt.velocimeter }, interference: { dust: c.dust, glare: c.glare },
    target: { x: c.east, y: c.north }, start: startState(),
  };
}
const controller = () => opt.strategy === "autonomous" ? autopilot({ hazardAvoidance: opt.hazard !== "none", scanAltitudeM: cfg.scanAlt,
  divertRadiusM: cfg.divertR, terminalAltitudeM: cfg.termAlt, terminalRateMps: cfg.termRate, maxGuidanceTiltDeg: cfg.maxTilt }) : undefined;
function fly(input: SimInput): FlightTelemetry {
  const sim = createSim(input, controller());
  while (!sim.state.done) sim.step();
  return sim.telemetry();
}
function setup(): FlightSetup {
  return { target: { x: cfg.east, y: cfg.north }, refElevation: baseTerrain.heightAt(cfg.east, cfg.north), gravity: cfg.gravity, airDensity: cfg.air,
    wind: site.wind ?? { x: 0, y: 0 }, dust: cfg.dust, hazardScan: opt.strategy === "autonomous" && opt.hazard !== "none",
    scanAltitudeM: cfg.scanAlt, divertRadiusM: cfg.divertR, legRadiusM: DEFAULT_LANDER.legRadiusM, maxSlopeDeg: cfg.limSlope, maxRoughnessM: DEFAULT_LANDER.limits.maxRoughnessM };
}

// ---------------------------------------------------------------------- view

let view!: FlightView;
let prediction: FlightTelemetry | null = null;
let live: Sim | null = null;
let result: FlightSummary | null = null;
function buildView() {
  const t0 = performance.now();
  const look = view ? { az: view.az, el: view.el, zoom: view.zoom, clock: view.idleClock } : null;
  view?.dispose();
  const b: Boulder[] = boulderList().map((r) => ({ x: r.x - cfg.east, z: -(r.y - cfg.north), r: r.r, h: r.h }));
  view = new FlightView($("stage"), ENV, { terrain: pack, landing: simToPack(pack, { x: cfg.east, y: cfg.north }), boulders: b,
    letterbox: false, showSkip: false, muted: $<HTMLInputElement>("mute").checked });
  if (look) { view.az = look.az; view.el = look.el; view.zoom = look.zoom; view.idleClock = look.clock; }   // keep the viewpoint when the scene is rebuilt
  view.camMode = $<HTMLSelectElement>("cam").value as CamMode; view.speed = Number($<HTMLSelectElement>("speed").value);
  idle();
  if (q.has("timing")) console.log("BUILDVIEW ms", Math.round(performance.now() - t0));
}
function idle() { live = null; result = null; view.showIdle(setup(), startState().position, prediction?.samples); $("resultCard").hidden = true; setLog([]); }

const OUT: Record<string, [string, string]> = { success: ["SUCCESS", "#3ddc97"], "hard-landing": ["HARD LANDING", "#ffb347"], "tip-over": ["TIP-OVER", "#ff7a59"], crash: ["CRASH", "#ff4d4d"], timeout: ["TIMEOUT", "#9aa4b2"] };
let marginJob = 0;
function predict() {
  if (opt.strategy === "manual") { prediction = null; $("pred").innerHTML = '<div class="dim">Manual flight: no prediction. W/S throttle, arrows tilt, X cuts the engine.</div>'; view?.setPrediction(); drawMap(); drawChart(); return; }
  const t0 = performance.now();
  prediction = fly(simInput());
  const s = prediction.summary!, [name, color] = OUT[s.outcome];
  const twr = (cfg.thrust * 1000) / ((cfg.dryMass + cfg.fuel) * cfg.gravity);
  $("pred").innerHTML = `<div class="chip" style="background:${color}">${name}</div>
    <div class="kv"><span>Survivability</span><b>${s.survivability}%</b></div>
    <div class="kv"><span>Touchdown sink / lateral</span><b>${s.verticalSpeedMps.toFixed(2)} / ${s.horizontalSpeedMps.toFixed(2)} m/s</b></div>
    <div class="kv"><span>Ground slope</span><b>${s.slopeDeg.toFixed(1)}°</b></div>
    <div class="kv"><span>Fuel left</span><b>${s.fuelRemainingKg.toFixed(0)} kg</b></div>
    <div class="kv"><span>Flight time</span><b>${s.flightTimeS.toFixed(1)} s</b></div>
    <div class="kv"><span>Miss distance</span><b>${s.distanceFromTargetM.toFixed(1)} m${s.diverted ? " (diverted)" : ""}</b></div>
    <div class="kv"><span>Thrust-to-weight at start</span><b>${twr.toFixed(2)}</b></div>
    ${s.failureReasons.length ? `<div class="why">${s.failureReasons.map(esc).join("<br>")}</div>` : ""}
    <div class="kv"><span>Min fuel for success</span><b id="mFuel">…</b></div>
    <div class="kv"><span>Min thrust for success</span><b id="mThrust">…</b></div>
    <div class="dim">Computed by the physics engine in ${(performance.now() - t0).toFixed(0)} ms</div>`;
  view?.setPrediction(prediction.samples); drawMap(); drawChart();
  // margins: bisect on fuel and thrust, a few flights per tick so the sliders stay responsive
  const job = ++marginJob;
  const bisect = (key: "fuel" | "thrust", lo: number, done: (v: number | null) => void) => {
    if (s.outcome !== "success") return done(null);
    let hi = cfg[key], n = 0;
    const tick = () => {
      if (job !== marginJob) return;
      const mid = (lo + hi) / 2;
      if (fly(simInput({ [key]: mid })).summary!.outcome === "success") hi = mid; else lo = mid;
      if (++n < 9) setTimeout(tick, 0); else done(hi);
    };
    setTimeout(tick, 60);
  };
  bisect("fuel", 0, (v) => { const e = document.getElementById("mFuel"); if (e) e.textContent = v == null ? "n/a" : `${v.toFixed(0)} kg (margin ${(100 * (1 - v / cfg.fuel)).toFixed(0)}%)`;
    bisect("thrust", 1, (w) => { const e2 = document.getElementById("mThrust"); if (e2) e2.textContent = w == null ? "n/a" : `${w.toFixed(1)} kN (margin ${(100 * (1 - w / cfg.thrust)).toFixed(0)}%)`; }); });
}
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

// ------------------------------------------------------------------- map/chart

const MAP = 250, hs = document.createElement("canvas"); hs.width = hs.height = MAP;
function shadeMap() {
  const ctx = hs.getContext("2d")!, img = ctx.createImageData(MAP, MAP), half = 2400;
  for (let j = 0; j < MAP; j++) for (let i = 0; i < MAP; i++) {
    const x = -half + ((i + 0.5) / MAP) * 4800, y = half - ((j + 0.5) / MAP) * 4800, d = 20;
    const gx = (baseTerrain.heightAt(x + d, y) - baseTerrain.heightAt(x - d, y)) / (2 * d), gy = (baseTerrain.heightAt(x, y + d) - baseTerrain.heightAt(x, y - d)) / (2 * d);
    const slope = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI, lit = Math.max(0.25, Math.min(1.25, 0.8 + (-gx * -0.6 + -gy * 0.6) * 2.2));
    const steep = slope > cfg.limSlope, o = (j * MAP + i) * 4;
    img.data[o] = (steep ? 235 : 178) * lit; img.data[o + 1] = (steep ? 90 : 160) * lit; img.data[o + 2] = (steep ? 70 : 128) * lit; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
const m2p = (x: number, y: number) => [((x + 2400) / 4800) * MAP, ((2400 - y) / 4800) * MAP];
function drawMap() {
  const ctx = $<HTMLCanvasElement>("map").getContext("2d")!;
  ctx.drawImage(hs, 0, 0);
  const line = (pts: { x: number; y: number }[], color: string, w: number) => { ctx.beginPath(); pts.forEach((p, i) => { const [a, b] = m2p(p.x, p.y); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); };
  if (prediction) line(prediction.samples, "#7fdcff", 1.5);
  if (live) line(live.telemetry().samples, "#ffd27a", 2);
  const [tx, ty] = m2p(cfg.east, cfg.north), st = startState().position, [sx, sy] = m2p(st.x, st.y);
  ctx.strokeStyle = "#3ddc97"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx, ty, 6, 0, 7); ctx.moveTo(tx - 9, ty); ctx.lineTo(tx + 9, ty); ctx.moveTo(tx, ty - 9); ctx.lineTo(tx, ty + 9); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, 7); ctx.fill();
  if (live) { const [lx, ly] = m2p(live.state.position.x, live.state.position.y); ctx.fillStyle = "#ffd27a"; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 7); ctx.fill(); }
}
function drawChart() {
  const cv = $<HTMLCanvasElement>("chart"), ctx = cv.getContext("2d")!, W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const src = prediction?.samples ?? live?.telemetry().samples ?? [];
  if (src.length < 2) return;
  const T = Math.max(src[src.length - 1].t, live?.state.t ?? 0), maxAlt = Math.max(...src.map((p) => p.altitudeAGL), 1), maxV = Math.max(...src.map((p) => -p.vz), 1);
  const plot = (get: (p: (typeof src)[0]) => number, max: number, color: string, list = src, w = 1.5) => { ctx.beginPath(); list.forEach((p, i) => { const x = (p.t / T) * W, y = H - 4 - (get(p) / max) * (H - 10); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); };
  ctx.fillStyle = "rgba(255,170,60,.16)"; ctx.beginPath(); ctx.moveTo(0, H); src.forEach((p) => ctx.lineTo((p.t / T) * W, H - p.throttle * (H * 0.45))); ctx.lineTo(W, H); ctx.fill();
  plot((p) => p.altitudeAGL, maxAlt, "#7fdcff"); plot((p) => Math.max(0, -p.vz), maxV, "#c79bff");
  if (live) { plot((p) => p.altitudeAGL, maxAlt, "#ffd27a", live.telemetry().samples, 2); const x = (live.state.t / T) * W; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.fillStyle = "#8b96a5"; ctx.font = "19px ui-monospace,monospace"; ctx.textAlign = "right";
  ctx.fillStyle = "#7fdcff"; ctx.fillText(`altitude, max ${maxAlt.toFixed(0)} m`, W - 8, 22); ctx.fillStyle = "#c79bff"; ctx.fillText(`sink rate, max ${maxV.toFixed(0)} m/s`, W - 8, 46); ctx.fillStyle = "#ffaa3c"; ctx.fillText("throttle", W - 8, 70); ctx.textAlign = "left";
}

// ----------------------------------------------------------------------- HUD

let log: string[] = [];
function setLog(l: string[]) { log = l; $("log").innerHTML = l.slice(-9).map((x) => `<div>${x}</div>`).join(""); }
function onEvent(e: SimEvent) {
  const t = `<i>T+${e.t.toFixed(1)}</i> `;
  const text: Record<string, string> = { engineOn: "Engine ignition", engineOff: "Engine cutoff", fuelOut: "<b class='bad'>Fuel exhausted</b>", timeout: "Flight timed out" };
  let msg = text[e.type] ?? e.type;
  if (e.type === "dustKickup") msg = `Dust kick-up at ${e.altitudeM.toFixed(0)} m`;
  if (e.type === "hazardDetected") msg = `<b class='warn'>Hazard at aim point</b>: slope ${e.slopeDeg.toFixed(1)}°, rocks ${e.roughnessM.toFixed(2)} m`;
  if (e.type === "divert") msg = `<b class='warn'>Divert ${e.distanceM.toFixed(0)} m</b> to a safe spot`;
  if (e.type === "fuelLow") msg = `<b class='warn'>Fuel low</b>: ${e.fuelKg.toFixed(0)} kg`;
  if (e.type === "touchdown") msg = `Contact: ${e.verticalSpeedMps.toFixed(2)} m/s down, ${e.horizontalSpeedMps.toFixed(2)} m/s sideways`;
  if (e.type === "crash") msg = `<b class='bad'>Crash</b> at ${e.impactSpeedMps.toFixed(1)} m/s`;
  if (e.type === "tipOver") msg = `<b class='bad'>Tip-over</b> on a ${e.slopeDeg.toFixed(1)}° slope`;
  setLog([...log, t + msg]);
}
function phase(s: Sim["state"], dist: number) {
  if (s.done) return "FLIGHT ENDED";
  if (opt.strategy === "manual") return "MANUAL CONTROL";
  if (s.throttle === 0 && s.altitudeAGL > 60) return "COAST";
  if (s.altitudeAGL > cfg.scanAlt) return "BRAKING";
  if (s.altitudeAGL > cfg.termAlt) return "APPROACH";
  return dist > 2 || Math.hypot(s.velocity.x, s.velocity.y) > 0.4 ? "HOVER AND TRANSLATE" : "TERMINAL DESCENT";
}
let hudT = 0;
function hudLoop(now: number) {
  requestAnimationFrame(hudLoop);
  if (now - hudT < 90) return; hudT = now;
  const s = live?.state, set = (id: string, v: string) => { $(id).textContent = v; };
  if (!s) { const st = startState(); set("hAlt", cfg.altitude.toFixed(0)); set("hVs", (-cfg.descent).toFixed(1)); set("hHs", cfg.groundSpeed.toFixed(1)); set("hThr", "0"); set("hFuel", cfg.fuel.toFixed(0)); set("hTilt", "0.0"); set("hMet", "0.0"); set("hPhase", "READY"); set("hRadar", "standby"); $("fuelBar").style.width = "100%"; void st; return; }
  const obs = live!.observe(), aim = live!.telemetry().summary?.finalAimPoint ?? { x: cfg.east, y: cfg.north };
  const dist = Math.hypot(s.position.x - aim.x, s.position.y - aim.y);
  set("hAlt", s.altitudeAGL.toFixed(s.altitudeAGL < 100 ? 1 : 0)); set("hVs", s.velocity.z.toFixed(1)); set("hHs", Math.hypot(s.velocity.x, s.velocity.y).toFixed(1));
  set("hThr", (s.throttle * 100).toFixed(0)); set("hFuel", s.fuelKg.toFixed(0)); set("hMet", s.t.toFixed(1));
  set("hTilt", ((Math.atan(Math.hypot(Math.tan(s.tiltX), Math.tan(s.tiltY))) * 180) / Math.PI).toFixed(1)); set("hPhase", phase(s, dist));
  $("fuelBar").style.width = `${(100 * s.fuelKg) / cfg.fuel}%`; $("fuelBar").style.background = s.fuelKg < cfg.fuel * 0.1 ? "#ff4d4d" : "#3ddc97";
  $("hRadar").innerHTML = s.done ? "off" : `${obs.altitudeAGL.toFixed(1)} m ${obs.altimeterValid ? "" : "<b class='bad'>NO LOCK</b>"}${obs.velocimeterValid ? "" : " <b class='bad'>VEL DROPOUT</b>"}`;
  drawMap(); drawChart();
}

// ------------------------------------------------------------------- controls

const pressed = new Set<string>(); let pilot = createManualPilot();
function launch() {
  site = buildSite(); result = null; $("resultCard").hidden = true; setLog([]);
  const input = simInput(), s = setup();
  const go = () => {
    live = createSim(input, controller()); pilot = createManualPilot();
    view.speed = Number($<HTMLSelectElement>("speed").value);
    view.fly(live, s, { onEvent, controls: opt.strategy === "manual" ? (dt) => pilot.update(keysToPilotInput(pressed), dt) : undefined, onEnd: (sum) => { result = sum; showResult(sum); } });
  };
  if (opt.intro) { live = null; view.audio.start(); void view.play("opening", { start: input.start, target: input.target }).then(go); } else go();
}
function showResult(s: FlightSummary) {
  const [name, color] = OUT[s.outcome];
  $("resultCard").hidden = false;
  $("resultCard").innerHTML = `<div class="chip" style="background:${color}">${name}</div> <b>${s.survivability}% survivability</b>
    <div class="dim">Sink ${s.verticalSpeedMps.toFixed(2)} m/s · lateral ${s.horizontalSpeedMps.toFixed(2)} m/s · slope ${s.slopeDeg.toFixed(1)}° · fuel left ${s.fuelRemainingKg.toFixed(0)} kg · miss ${s.distanceFromTargetM.toFixed(1)} m</div>
    ${s.failureReasons.length ? `<div class="why">${s.failureReasons.map(esc).join("<br>")}</div>` : ""}
    <button id="dl">Download telemetry JSON</button>`;
  $("dl").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(live!.telemetry())], { type: "application/json" })); a.download = "telemetry.json"; a.click(); };
}

let terrainTimer = 0;
function changed(terrain: boolean) {
  if (terrain) { clearTimeout(terrainTimer); terrainTimer = window.setTimeout(() => { site = buildSite(); predict(); buildView(); }, 250); return; }
  site = buildSite(); predict();
  if (!live) view.showIdle(setup(), startState().position, prediction?.samples);
}
function syncSliders() { for (const s of SLIDERS) { $<HTMLInputElement>("s_" + s.key).value = String(cfg[s.key]); $("v_" + s.key).textContent = fmt(s); } }
const fmt = (s: Slider) => `${cfg[s.key].toFixed(s.step < 0.1 ? 2 : s.step < 1 ? 1 : 0)}${s.unit ? " " + s.unit : ""}`;

function buildUi() {
  const groups = [...new Set(SLIDERS.map((s) => s.group))];
  $("sliders").innerHTML = groups.map((g, gi) => `<details ${gi < 4 ? "open" : ""}><summary>${g}</summary>
    ${g === "Environment" ? '<div class="chips"><button data-body="moon">Moon</button><button data-body="mars">Mars</button><button data-body="earth">Earth</button></div>' : ""}
    ${SLIDERS.filter((s) => s.group === g).map((s) => `<label for="s_${s.key}"><span>${s.label}</span><b id="v_${s.key}"></b></label>
      <input type="range" id="s_${s.key}" min="${s.min}" max="${s.max}" step="${s.step}">`).join("")}
    ${g === "Landing target" ? '<div class="dim">Or click the map. Boulders are synthetic test hazards added to the real terrain.</div>' : ""}</details>`).join("");
  for (const s of SLIDERS) {
    const el = $<HTMLInputElement>("s_" + s.key);
    el.oninput = () => { cfg[s.key] = Number(el.value); $("v_" + s.key).textContent = fmt(s); if (s.key === "limSlope") shadeMap(); changed(!!s.terrain); };
  }
  const BODY: Record<string, [number, number]> = { moon: [1.62, 0], mars: [3.71, 0.02], earth: [9.81, 1.225] };
  document.querySelectorAll<HTMLButtonElement>("button[data-body]").forEach((b) => (b.onclick = () => { [cfg.gravity, cfg.air] = BODY[b.dataset.body!]; syncSliders(); changed(false); }));
  $("scenarios").innerHTML = Object.entries(SCENARIOS).map(([k, v]) => `<button data-sc="${k}">${v.label}</button>`).join("");
  document.querySelectorAll<HTMLButtonElement>("button[data-sc]").forEach((b) => (b.onclick = () => {
    for (const s of SLIDERS) cfg[s.key] = s.value;
    Object.assign(opt, { strategy: "autonomous", hazard: "lidar" }, SCENARIOS[b.dataset.sc!].opt); Object.assign(cfg, SCENARIOS[b.dataset.sc!].set);
    $<HTMLSelectElement>("strategy").value = opt.strategy; $<HTMLSelectElement>("hazard").value = opt.hazard; syncSliders(); shadeMap(); changed(true);
  }));
  const sel = (id: string, fn: (v: string) => void) => { $<HTMLSelectElement>(id).onchange = (e) => fn((e.target as HTMLSelectElement).value); };
  sel("strategy", (v) => { opt.strategy = v as typeof opt.strategy; if (v === "manual") { $<HTMLSelectElement>("speed").value = "1"; view.speed = 1; } changed(false); });
  sel("hazard", (v) => { opt.hazard = v as typeof opt.hazard; changed(false); });
  sel("cam", (v) => { view.camMode = v as CamMode; });
  sel("speed", (v) => { view.speed = Number(v); });
  $<HTMLInputElement>("velocimeter").onchange = (e) => { opt.velocimeter = (e.target as HTMLInputElement).checked; changed(false); };
  $<HTMLInputElement>("intro").onchange = (e) => { opt.intro = (e.target as HTMLInputElement).checked; };
  $<HTMLInputElement>("mute").onchange = (e) => view.setMuted((e.target as HTMLInputElement).checked);
  $<HTMLInputElement>("seed").onchange = (e) => { opt.seed = Number((e.target as HTMLInputElement).value) || 1; changed(cfg.boulders > 0); };
  $("launch").onclick = launch;
  $("reset").onclick = idle;
  $("pause").onclick = () => { view.paused = !view.paused; $("pause").textContent = view.paused ? "Resume" : "Pause"; };
  $<HTMLCanvasElement>("map").onclick = (e) => {
    const r = (e.target as HTMLElement).getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 4800 - 2400, y = 2400 - ((e.clientY - r.top) / r.height) * 4800;
    cfg.east = Math.max(-2100, Math.min(2100, Math.round(x / 10) * 10)); cfg.north = Math.max(-2100, Math.min(2100, Math.round(y / 10) * 10)); syncSliders(); changed(true);
  };
  window.addEventListener("keydown", (e) => { const t = e.target as HTMLElement; if (t.tagName === "INPUT" || t.tagName === "SELECT") return; if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault(); pressed.add(e.code); if (e.code === "Space") $("pause").click(); });
  window.addEventListener("keyup", (e) => pressed.delete(e.code));
  syncSliders();
}

// ----------------------------------------------------------------------- boot

buildUi(); shadeMap();
if (q.get("sc") && SCENARIOS[q.get("sc")!]) { Object.assign(opt, SCENARIOS[q.get("sc")!].opt); Object.assign(cfg, SCENARIOS[q.get("sc")!].set); syncSliders(); }
if (q.get("cam")) $<HTMLSelectElement>("cam").value = q.get("cam")!;
if (q.has("intro")) { opt.intro = true; $<HTMLInputElement>("intro").checked = true; }
if (q.get("strategy") === "manual") { opt.strategy = "manual"; $<HTMLSelectElement>("strategy").value = "manual"; }
site = buildSite(); predict(); buildView(); requestAnimationFrame(hudLoop);
// test hook for headless screenshots: ?launch&at=85&run=3 jumps to T+85 s, then runs 3 more seconds and holds
if (q.has("launch")) {
  launch();
  const l = live as Sim | null;
  if (q.get("at") && l) {
    const at = Number(q.get("at")); while (!l.state.done && l.state.t < at) l.step();
    view.speed = Number(q.get("speed") ?? 1); view.settle(Math.round(Number(q.get("run") ?? 3) * 30)); hudT = 0; hudLoop(1e9);
  }
} else if (q.has("still")) { view.settle(60); }
if (q.has("camtest")) console.log("CAMTEST", q.get("sc") ?? "nominal", JSON.stringify(view.cameraStats(Number(q.get("speed") ?? 4))));
(window as unknown as { lab: unknown }).lab = { get view() { return view; }, get live() { return live; }, get result() { return result; } };
