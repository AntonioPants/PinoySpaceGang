import {
  createSim,
  createManualPilot,
  keysToPilotInput,
  parseSites,
  slopeDegAt,
  roughnessAt,
  gradientAt,
  GridTerrain,
  syntheticTerrain,
  DEFAULT_LANDER,
} from '../src/index.ts';
import type { Sim, SimEvent, SimInput, SiteTerrain, Vec2 } from '../src/index.ts';

// ---------------------------------------------------------------- DOM helpers
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const sideCanvas = $<HTMLCanvasElement>('side');
const topCanvas = $<HTMLCanvasElement>('top');
const side = sideCanvas.getContext('2d')!;
const top = topCanvas.getContext('2d')!;
const siteSel = $<HTMLSelectElement>('site');
const statusEl = $('status');
const logEl = $('log');
const resultEl = $('result');

// ---------------------------------------------------------------- sites
const boulders = [{ center: { x: 0, y: 0 }, radiusM: 25, count: 60 }];
const presets: Record<string, { label: string; make: () => SiteTerrain }> = {
  moon: { label: 'Moon — highlands (synthetic)', make: () => syntheticTerrain({ id: 'moon', body: 'moon', craters: 6 }) },
  moonRocks: {
    label: 'Moon — boulder field at target',
    make: () => syntheticTerrain({ id: 'moon-boulders', body: 'moon', craters: 6, boulderFields: boulders }),
  },
  mars: { label: 'Mars — plains (synthetic)', make: () => syntheticTerrain({ id: 'mars', body: 'mars', craters: 4, wind: { x: 6, y: 2 } }) },
  marsRocks: {
    label: 'Mars — boulder field at target',
    make: () => syntheticTerrain({ id: 'mars-boulders', body: 'mars', craters: 4, wind: { x: 6, y: 2 }, boulderFields: boulders }),
  },
  slope: {
    label: 'Moon — 14° slope (tip-over test)',
    make: () => syntheticTerrain({ id: 'moon-slope', body: 'moon', hillsM: 1, baseSlopeDeg: 14 }),
  },
  earth: {
    label: 'Earth analog for Mars (synthetic)',
    make: () =>
      syntheticTerrain({ id: 'earth-analog', body: 'earth', analogOf: 'mars', wind: { x: 8, y: 0 }, boulderFields: boulders }),
  },
};
const siteCache = new Map<string, SiteTerrain>();
const fileSites = new Map<string, SiteTerrain>();

function fillSiteOptions() {
  siteSel.innerHTML = '';
  for (const [k, p] of Object.entries(presets)) siteSel.add(new Option(p.label, `preset:${k}`));
  for (const [id, s] of fileSites) siteSel.add(new Option(`sites.json — ${s.name ?? id}`, `file:${id}`));
}
fillSiteOptions();

function getSite(key: string): SiteTerrain {
  if (key.startsWith('file:')) return fileSites.get(key.slice(5))!;
  if (!siteCache.has(key)) siteCache.set(key, presets[key.slice(7)].make());
  return siteCache.get(key)!;
}

$<HTMLInputElement>('sitesFile').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const sites = parseSites(JSON.parse(await file.text()));
    for (const s of sites) fileSites.set(s.id, s);
    fillSiteOptions();
    siteSel.value = `file:${sites[0].id}`;
    statusEl.textContent = `Loaded ${sites.length} site(s) from ${file.name}`;
  } catch (err) {
    statusEl.textContent = `sites.json error: ${(err as Error).message}`;
  }
});

// ---------------------------------------------------------------- form
const val = (id: string) => $<HTMLInputElement>(id).value;
for (const id of ['dust', 'glare']) {
  const el = $<HTMLInputElement>(id);
  el.addEventListener('input', () => ($(`${id}V`).textContent = el.value));
}
$<HTMLSelectElement>('strategy').addEventListener('change', () => {
  $<HTMLSelectElement>('speed').value = val('strategy') === 'manual' ? '1' : '4';
});

function readInput(): SimInput {
  const env = val('gravity') as 'target' | 'native';
  return {
    site: getSite(siteSel.value),
    strategy: val('strategy') as SimInput['strategy'],
    sensors: { hazard: val('hazard') as 'lidar' | 'camera' | 'none', velocimeter: $<HTMLInputElement>('velocimeter').checked },
    interference: { dust: Number(val('dust')), glare: Number(val('glare')) },
    gravity: env,
    atmosphere: env,
    lander: { fuelKg: Number(val('fuel')), maxThrustN: Number(val('thrust')) * 1000 },
    seed: Number(val('seed')) || 1,
  };
}

// ---------------------------------------------------------------- run state
interface Particle { x: number; z: number; vx: number; vz: number; life: number; max: number; kind: 'dust' | 'fire' | 'debris' }

let sim: Sim | undefined;
let input: SimInput | undefined;
let paused = false;
let aim: Vec2 = { x: 0, y: 0 };
let scanCircle: { at: Vec2; r: number; t: number } | undefined;
let trail: Array<{ x: number; y: number; z: number }> = [];
let particles: Particle[] = [];
let shake = 0;
let landedT = 0;
let topImage: { canvas: HTMLCanvasElement; cx: number; cy: number; mPerPx: number; size: number } | undefined;
const cam = { x: 0, zBottom: 0, viewH: 1200, init: false };
const pressed = new Set<string>();
let pilot = createManualPilot();

function launch() {
  input = readInput();
  sim = createSim(input);
  pilot = createManualPilot();
  aim = { ...(input.target ?? { x: 0, y: 0 }) };
  scanCircle = undefined;
  trail = [];
  particles = [];
  shake = 0;
  landedT = 0;
  cam.init = false;
  paused = false;
  $('pause').textContent = 'Pause';
  logEl.innerHTML = '';
  resultEl.style.display = 'none';
  topImage = renderTopImage(input.site, aim);
  sim.on(onEvent);
  statusEl.textContent = `${input.site.id} · g = ${sim.gravity} m/s² · ρ = ${sim.airDensity} kg/m³ · ${input.strategy}`;
}

function onEvent(e: SimEvent) {
  const li = document.createElement('li');
  li.innerHTML = `<time>${e.t.toFixed(1)}s</time>${describe(e)}`;
  logEl.prepend(li);
  const s = sim!.state;
  if (e.type === 'divert') {
    aim = e.to;
    scanCircle = { at: e.from, r: 120, t: performance.now() };
  }
  if (e.type === 'hazardDetected') scanCircle = { at: e.at, r: 120, t: performance.now() };
  if (e.type === 'crash') {
    shake = 1;
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI;
      const v = 4 + Math.random() * 22;
      particles.push({ x: s.position.x, z: s.position.z + 1, vx: Math.cos(a) * v, vz: Math.sin(a) * v, life: 0, max: 1 + Math.random() * 1.6, kind: i % 4 === 0 ? 'debris' : 'fire' });
    }
  }
  if (e.type === 'touchdown') landedT = performance.now();
}

function describe(e: SimEvent): string {
  switch (e.type) {
    case 'dustKickup': return `dust kick-up at ${e.altitudeM.toFixed(0)} m (intensity ${e.intensity.toFixed(2)})`;
    case 'hazardDetected': return `<b style="color:var(--warn)">hazard</b> at aim: slope ${e.slopeDeg.toFixed(1)}°, rocks ${e.roughnessM.toFixed(2)} m`;
    case 'divert': return `<b style="color:var(--ok)">divert</b> ${e.distanceM.toFixed(1)} m → (${e.to.x.toFixed(0)}, ${e.to.y.toFixed(0)})`;
    case 'fuelLow': return `<b style="color:var(--warn)">fuel low</b> ${e.fuelKg.toFixed(0)} kg`;
    case 'fuelOut': return `<b style="color:var(--bad)">fuel out</b>`;
    case 'touchdown': return `touchdown — ${e.outcome} (sink ${e.verticalSpeedMps.toFixed(2)}, lateral ${e.horizontalSpeedMps.toFixed(2)} m/s)`;
    case 'crash': return `<b style="color:var(--bad)">crash</b> at ${e.impactSpeedMps.toFixed(1)} m/s`;
    case 'tipOver': return `<b style="color:var(--bad)">tip-over</b> on ${e.slopeDeg.toFixed(1)}° ground`;
    default: return e.type;
  }
}

function showResult() {
  const sum = sim!.telemetry().summary;
  if (!sum) return;
  const color = { success: 'var(--ok)', 'hard-landing': 'var(--warn)', 'tip-over': 'var(--bad)', crash: 'var(--bad)', timeout: 'var(--bad)' }[sum.outcome];
  resultEl.style.display = 'block';
  resultEl.style.borderColor = color;
  resultEl.innerHTML = `
    <div class="outcome" style="color:${color}">${sum.outcome}</div>
    <div>Survivability <b>${sum.survivability}%</b></div>
    ${sum.failureReasons.length ? `<ul>${sum.failureReasons.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
    <table>
      <tr><td>Sink rate</td><td>${sum.verticalSpeedMps.toFixed(2)} m/s</td></tr>
      <tr><td>Lateral speed</td><td>${sum.horizontalSpeedMps.toFixed(2)} m/s</td></tr>
      <tr><td>Ground slope</td><td>${sum.slopeDeg.toFixed(1)}°</td></tr>
      <tr><td>Rocks under legs</td><td>${sum.roughnessM.toFixed(2)} m</td></tr>
      <tr><td>Fuel used / left</td><td>${sum.fuelUsedKg.toFixed(0)} / ${sum.fuelRemainingKg.toFixed(0)} kg</td></tr>
      <tr><td>Miss distance</td><td>${sum.distanceFromTargetM.toFixed(1)} m${sum.diverted ? ' (diverted)' : ''}</td></tr>
      <tr><td>Flight time</td><td>${sum.flightTimeS.toFixed(1)} s</td></tr>
    </table>
    <div class="buttons"><button id="dl">Download telemetry JSON</button></div>`;
  $('dl').onclick = () => {
    const blob = new Blob([JSON.stringify(sim!.telemetry(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `telemetry-${input!.site.id}-seed${input!.seed}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
}

// ---------------------------------------------------------------- top view (pre-rendered hillshade)
function renderTopImage(site: SiteTerrain, center: Vec2) {
  const size = 440;
  const mPerPx = 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const terr = new GridTerrain(site.heightmap);
  let lo = Infinity;
  let hi = -Infinity;
  const hs = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const h = terr.heightAt(center.x + (px - size / 2) * mPerPx, center.y + (size / 2 - py) * mPerPx);
      hs[py * size + px] = h;
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  const tint = site.analogOf === 'mars' || site.body === 'mars' ? [196, 120, 80] : site.body === 'earth' ? [150, 140, 120] : [170, 170, 175];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = py * size + px;
      const hx = hs[py * size + Math.min(px + 1, size - 1)] - hs[py * size + Math.max(px - 1, 0)];
      const hy = hs[Math.max(py - 1, 0) * size + px] - hs[Math.min(py + 1, size - 1) * size + px];
      const shade = Math.max(0.15, Math.min(1.3, 0.75 - (hx - hy) / (2 * mPerPx) * 2.5));
      const elev = hi > lo ? (hs[i] - lo) / (hi - lo) : 0.5;
      const k = shade * (0.55 + 0.45 * elev);
      const wx = center.x + (px - size / 2) * mPerPx;
      const wy = center.y + (size / 2 - py) * mPerPx;
      const steep =
        slopeDegAt(terr, wx, wy, DEFAULT_LANDER.legRadiusM) > DEFAULT_LANDER.limits.maxSlopeDeg ||
        roughnessAt(terr, wx, wy, DEFAULT_LANDER.legRadiusM) > DEFAULT_LANDER.limits.maxRoughnessM;
      img.data[i * 4] = steep ? 230 : tint[0] * k;
      img.data[i * 4 + 1] = steep ? 70 : tint[1] * k;
      img.data[i * 4 + 2] = steep ? 60 : tint[2] * k;
      img.data[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, cx: center.x, cy: center.y, mPerPx, size };
}

function drawTop() {
  const W = topCanvas.width;
  top.fillStyle = '#000';
  top.fillRect(0, 0, W, W);
  if (!topImage || !sim) return;
  top.drawImage(topImage.canvas, 0, 0, W, W);
  const k = W / topImage.size / topImage.mPerPx;
  const toPx = (p: Vec2) => [W / 2 + (p.x - topImage!.cx) * k, W / 2 - (p.y - topImage!.cy) * k] as const;

  // scan / divert ring
  if (scanCircle) {
    const [x, y] = toPx(scanCircle.at);
    top.strokeStyle = 'rgba(255,204,77,0.6)';
    top.setLineDash([4, 4]);
    top.beginPath();
    top.arc(x, y, scanCircle.r * k, 0, Math.PI * 2);
    top.stroke();
    top.setLineDash([]);
  }
  // target
  const [tx, ty] = toPx(input!.target ?? { x: 0, y: 0 });
  top.strokeStyle = '#fff';
  top.lineWidth = 1.5;
  top.beginPath();
  top.moveTo(tx - 8, ty); top.lineTo(tx + 8, ty);
  top.moveTo(tx, ty - 8); top.lineTo(tx, ty + 8);
  top.stroke();
  // aim (after divert)
  if (aim.x !== (input!.target?.x ?? 0) || aim.y !== (input!.target?.y ?? 0)) {
    const [ax, ay] = toPx(aim);
    top.strokeStyle = '#4cd18a';
    top.beginPath();
    top.arc(ax, ay, 7, 0, Math.PI * 2);
    top.stroke();
  }
  // trail
  top.strokeStyle = 'rgba(255,179,71,0.8)';
  top.beginPath();
  trail.forEach((p, i) => {
    const [x, y] = toPx(p);
    i ? top.lineTo(x, y) : top.moveTo(x, y);
  });
  top.stroke();
  // lander
  const s = sim.state;
  const [lx, ly] = toPx(s.position);
  top.fillStyle = s.done ? outcomeColor() : '#ffb347';
  top.beginPath();
  top.arc(lx, ly, 4, 0, Math.PI * 2);
  top.fill();
  top.fillStyle = 'rgba(255,255,255,0.7)';
  top.font = '11px ui-monospace, monospace';
  top.fillText(`${(topImage.size * topImage.mPerPx).toFixed(0)} m across · red = unsafe (slope > 12° or rocks)`, 8, W - 8);
}

function outcomeColor() {
  const o = sim?.state.outcome;
  return o === 'success' ? '#4cd18a' : o === 'hard-landing' ? '#ffcc4d' : '#ff5d5d';
}

// ---------------------------------------------------------------- side view
function resizeSide() {
  const r = sideCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  sideCanvas.width = Math.round(r.width * dpr);
  sideCanvas.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resizeSide);
resizeSide();

function drawSide(dtReal: number) {
  const W = sideCanvas.width;
  const H = sideCanvas.height;
  const dpr = window.devicePixelRatio || 1;
  const grd = side.createLinearGradient(0, 0, 0, H);
  const air = sim && sim.airDensity > 0.5 ? ['#3a6ea5', '#9cc3e6'] : sim && sim.airDensity > 0 ? ['#3b2420', '#a8735a'] : ['#02040a', '#0b1220'];
  grd.addColorStop(0, air[0]);
  grd.addColorStop(1, air[1]);
  side.fillStyle = grd;
  side.fillRect(0, 0, W, H);
  if (!sim) {
    side.fillStyle = '#7d8fa3';
    side.font = `${16 * dpr}px ui-monospace, monospace`;
    side.fillText('Choose a setup on the left and press Launch', 24 * dpr, 40 * dpr);
    return;
  }

  const s = sim.state;
  const ground = sim.terrain.heightAt(s.position.x, s.position.y);
  const wantH = Math.min(1600, Math.max(45, s.altitudeAGL * 2.6 + 25));
  const wantBottom = ground - wantH * 0.18;
  if (!cam.init) {
    Object.assign(cam, { x: s.position.x, zBottom: wantBottom, viewH: wantH, init: true });
  }
  const f = 1 - Math.exp(-dtReal * 3);
  cam.x += (s.position.x - cam.x) * f;
  cam.viewH += (wantH - cam.viewH) * f;
  cam.zBottom += (wantBottom - cam.zBottom) * f;
  const scale = H / cam.viewH; // px per metre
  const sx = (Math.random() - 0.5) * shake * 18 * dpr;
  const sy = (Math.random() - 0.5) * shake * 18 * dpr;
  shake = Math.max(0, shake - dtReal * 1.2);
  const X = (x: number) => W / 2 + (x - cam.x) * scale + sx;
  const Z = (z: number) => H - (z - cam.zBottom) * scale + sy;

  // stars on airless bodies
  if (sim.airDensity === 0) {
    side.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 80; i++) side.fillRect((i * 997) % W, (i * 613) % (H * 0.7), 1.5 * dpr, 1.5 * dpr);
  }

  // terrain profile along the lander's y
  const tint = input!.site.body === 'mars' || input!.site.analogOf === 'mars' ? '#7a4a33' : input!.site.body === 'earth' ? '#5c5546' : '#555a63';
  side.fillStyle = tint;
  side.beginPath();
  side.moveTo(0, H);
  for (let px = 0; px <= W; px += 2) side.lineTo(px, Z(sim.terrain.heightAt(cam.x + (px - W / 2) / scale, s.position.y)));
  side.lineTo(W, H);
  side.closePath();
  side.fill();
  side.strokeStyle = 'rgba(255,255,255,0.25)';
  side.lineWidth = 1.5 * dpr;
  side.stroke();

  // target & aim markers
  const mark = (x: number, color: string, label: string) => {
    side.strokeStyle = color;
    side.setLineDash([6 * dpr, 6 * dpr]);
    side.beginPath();
    side.moveTo(X(x), 0);
    side.lineTo(X(x), H);
    side.stroke();
    side.setLineDash([]);
    side.fillStyle = color;
    side.font = `${11 * dpr}px ui-monospace, monospace`;
    side.fillText(label, X(x) + 4 * dpr, 16 * dpr);
  };
  mark(input!.target?.x ?? 0, 'rgba(255,255,255,0.5)', 'target');
  if (aim.x !== (input!.target?.x ?? 0)) mark(aim.x, 'rgba(76,209,138,0.8)', 'divert');

  // trail
  side.strokeStyle = 'rgba(255,179,71,0.5)';
  side.lineWidth = 1.5 * dpr;
  side.beginPath();
  trail.forEach((p, i) => (i ? side.lineTo(X(p.x), Z(p.z)) : side.moveTo(X(p.x), Z(p.z))));
  side.stroke();

  // particles
  const g = sim.gravity;
  particles = particles.filter((p) => (p.life += dtReal) < p.max);
  for (const p of particles) {
    p.vz -= (p.kind === 'dust' ? g * 0.3 : g) * dtReal;
    if (p.kind === 'dust') { p.vx *= 1 - dtReal * 0.8; }
    p.x += p.vx * dtReal;
    p.z = Math.max(sim.terrain.heightAt(p.x, s.position.y), p.z + p.vz * dtReal);
    const a = 1 - p.life / p.max;
    const r = Math.max(1.5 * dpr, (p.kind === 'dust' ? 1.2 + p.life * 2 : p.kind === 'fire' ? 0.8 + p.life : 0.3) * scale);
    side.fillStyle =
      p.kind === 'dust' ? `rgba(200,190,170,${a * 0.35})` : p.kind === 'fire' ? `rgba(255,${120 + 100 * a | 0},40,${a})` : `rgba(60,60,60,${a})`;
    side.beginPath();
    side.arc(X(p.x), Z(p.z), r, 0, Math.PI * 2);
    side.fill();
  }

  // dust kicked up by the plume near the ground
  if (s.throttle > 0 && s.altitudeAGL < 30 && !s.done) {
    const n = Math.ceil((1 - s.altitudeAGL / 30) * 6 * s.throttle * (1 + (input!.interference?.dust ?? 0)));
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      particles.push({ x: s.position.x, z: ground + 0.2, vx: dir * (6 + Math.random() * 14), vz: Math.random() * 3, life: 0, max: 1.5 + Math.random() * 1.5, kind: 'dust' });
    }
  }

  // lander
  if (sim.state.outcome !== 'crash') {
    const px = Math.max(scale, 3.2 * dpr); // never smaller than ~3 px per metre
    let angle = s.tiltX;
    if (s.outcome === 'tip-over') {
      // fall over towards downhill
      const downhill = gradientAt(sim.terrain, s.position.x, s.position.y, sim.lander.legRadiusM).x > 0 ? -1 : 1;
      angle += downhill * 1.35 * Math.min(1, (performance.now() - landedT) / 900);
    }
    side.save();
    side.translate(X(s.position.x), Z(s.position.z));
    side.rotate(angle);
    // flame
    if (s.throttle > 0 && !s.done) {
      const len = (2 + s.throttle * 9) * px * (0.85 + Math.random() * 0.3);
      const fl = side.createLinearGradient(0, -1.2 * px, 0, len);
      fl.addColorStop(0, 'rgba(255,240,200,0.95)');
      fl.addColorStop(1, 'rgba(255,120,40,0)');
      side.fillStyle = fl;
      side.beginPath();
      side.moveTo(-0.7 * px, -1.2 * px);
      side.lineTo(0.7 * px, -1.2 * px);
      side.lineTo(0, len);
      side.closePath();
      side.fill();
    }
    // legs
    side.strokeStyle = '#c9ced6';
    side.lineWidth = Math.max(1, 0.25 * px);
    side.beginPath();
    side.moveTo(-1.2 * px, -2 * px); side.lineTo(-2.5 * px, 0);
    side.moveTo(1.2 * px, -2 * px); side.lineTo(2.5 * px, 0);
    side.moveTo(-3 * px, 0); side.lineTo(-2 * px, 0);
    side.moveTo(2 * px, 0); side.lineTo(3 * px, 0);
    side.stroke();
    // descent stage + ascent stage
    side.fillStyle = '#d4a017';
    side.fillRect(-1.8 * px, -3.2 * px, 3.6 * px, 2 * px);
    side.fillStyle = '#b8bec8';
    side.fillRect(-1.3 * px, -5.4 * px, 2.6 * px, 2.2 * px);
    side.fillStyle = '#1b2533';
    side.fillRect(-0.6 * px, -4.9 * px, 1.2 * px, 0.8 * px);
    // success beacon
    if (s.outcome === 'success' && Math.floor(performance.now() / 400) % 2 === 0) {
      side.fillStyle = '#4cd18a';
      side.beginPath();
      side.arc(0, -6 * px, 0.6 * px + 2 * dpr, 0, Math.PI * 2);
      side.fill();
    }
    side.restore();
  }

  // scale bar
  const barM = niceMetres(cam.viewH / 6);
  side.fillStyle = 'rgba(255,255,255,0.8)';
  side.fillRect(16 * dpr, H - 20 * dpr, barM * scale, 2 * dpr);
  side.font = `${11 * dpr}px ui-monospace, monospace`;
  side.fillText(`${barM} m`, 16 * dpr, H - 26 * dpr);
  if (paused) {
    side.fillStyle = 'rgba(0,0,0,0.5)';
    side.fillRect(0, 0, W, H);
    side.fillStyle = '#fff';
    side.font = `${22 * dpr}px ui-monospace, monospace`;
    side.fillText('PAUSED', W / 2 - 45 * dpr, H / 2);
  }
}

function niceMetres(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((m) => m >= v) ?? 10 * p;
}

// ---------------------------------------------------------------- HUD
function setText(id: string, t: string) { $(id).textContent = t; }
function drawHud() {
  if (!sim) return;
  const s = sim.state;
  setText('hAlt', `${s.altitudeAGL.toFixed(1)} m`);
  setText('hT', `${s.t.toFixed(1)} s`);
  setText('hVz', `${(-s.velocity.z).toFixed(2)} m/s`);
  setText('hVh', `${Math.hypot(s.velocity.x, s.velocity.y).toFixed(2)} m/s`);
  setText('hThr', `${(s.throttle * 100).toFixed(0)} %`);
  setText('hFuel', `${s.fuelKg.toFixed(0)} kg`);
  setText('hTilt', `${(Math.atan(Math.hypot(Math.tan(s.tiltX), Math.tan(s.tiltY))) * 57.2958).toFixed(1)}°`);
  setText('hDist', `${Math.hypot(s.position.x - aim.x, s.position.y - aim.y).toFixed(1)} m`);
  $('bThr').style.width = `${s.throttle * 100}%`;
  $('bFuel').style.width = `${(s.fuelKg / sim.lander.fuelKg) * 100}%`;
  const lim = sim.lander.limits;
  $('hVz').style.color = -s.velocity.z > lim.maxVerticalMps && s.altitudeAGL < 30 ? 'var(--bad)' : '';
  $('hVh').style.color = Math.hypot(s.velocity.x, s.velocity.y) > lim.maxHorizontalMps && s.altitudeAGL < 30 ? 'var(--bad)' : '';
  $('hFuel').style.color = s.fuelKg < sim.lander.fuelKg * 0.1 ? 'var(--bad)' : '';
}

// ---------------------------------------------------------------- loop & input
let last = performance.now();
let trailTimer = 0;
function frame(now: number) {
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (sim && !paused && !sim.state.done) {
    const dtSim = dtReal * Number(val('speed'));
    const controls = input!.strategy === 'manual' ? pilot.update(keysToPilotInput(pressed), dtSim) : undefined;
    sim.advance(dtSim, controls);
    trailTimer += dtSim;
    if (trailTimer > 0.25) {
      trailTimer = 0;
      trail.push({ ...sim.state.position });
    }
  }
  if (sim?.state.done && resultEl.style.display === 'none') showResult();
  drawSide(dtReal);
  drawTop();
  drawHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

$('launch').addEventListener('click', launch);
$('pause').addEventListener('click', togglePause);
function togglePause() {
  paused = !paused;
  $('pause').textContent = paused ? 'Resume' : 'Pause';
}

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'number') return;
  if (e.code === 'Space') { e.preventDefault(); togglePause(); return; }
  if (e.code === 'KeyR') { launch(); return; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
  pressed.add(e.code);
});
window.addEventListener('keyup', (e) => pressed.delete(e.code));
window.addEventListener('blur', () => pressed.clear());

// ?site=moonRocks&speed=8&launch — handy for sharing a setup or quick checks
const params = new URLSearchParams(location.search);
if (params.get('site') && presets[params.get('site')!]) siteSel.value = `preset:${params.get('site')}`;
if (params.get('speed')) $<HTMLSelectElement>('speed').value = params.get('speed')!;
if (params.has('launch')) launch();
// ?at=80 fast-forwards the flight to t = 80 s (jump straight to the interesting part)
if (sim && params.get('at')) {
  const at = Number(params.get('at'));
  while (!sim.state.done && sim.state.t < at) {
    sim.step();
    if (Math.round(sim.state.t * 120) % 30 === 0) trail.push({ ...sim.state.position });
  }
}
