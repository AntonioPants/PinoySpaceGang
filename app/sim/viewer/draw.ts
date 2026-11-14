/**
 * Canvas renderers for the viewer. Plain functions over the Sim so they can be driven from
 * the useLanderSim frame loop without going through React renders.
 */
import { DEFAULT_LANDER, gradientAt, roughnessAt, slopeDegAt } from '../src/index.ts';
import type { Sim, SimInput, SiteTerrain, Vec2 } from '../src/index.ts';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** Current aim point and the latest hazard-scan location, derived from the event stream. */
export function aimFromEvents(sim: Sim, input: SimInput) {
  let aim: Vec2 = { ...(input.target ?? { x: 0, y: 0 }) };
  let scan: Vec2 | undefined;
  for (const e of sim.events) {
    if (e.type === 'hazardDetected') scan = e.at;
    if (e.type === 'divert') aim = e.to;
  }
  return { aim, scan, target: input.target ?? { x: 0, y: 0 } };
}

const isMarsLike = (s: SiteTerrain) => s.body === 'mars' || s.analogOf === 'mars';

// ------------------------------------------------------------------ top view

export interface TopImage {
  canvas: HTMLCanvasElement;
  cx: number;
  cy: number;
  mPerPx: number;
  size: number;
}

/** Hillshade of the area around `center`, with unsafe ground (slope or rocks over the limits) in red. */
export function renderTopImage(sim: Sim, site: SiteTerrain, center: Vec2, size = 440, mPerPx = 2): TopImage {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  const terr = sim.terrain; // includes generated boulders
  const hs = new Float32Array(size * size);
  let lo = Infinity;
  let hi = -Infinity;
  const wx = (px: number) => center.x + (px - size / 2) * mPerPx;
  const wy = (py: number) => center.y + (size / 2 - py) * mPerPx;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const h = terr.heightAt(wx(px), wy(py));
      hs[py * size + px] = h;
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  const tint = isMarsLike(site) ? [196, 120, 80] : site.body === 'earth' ? [150, 140, 120] : [170, 170, 175];
  const { legRadiusM, limits } = DEFAULT_LANDER;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = py * size + px;
      const hx = hs[py * size + Math.min(px + 1, size - 1)] - hs[py * size + Math.max(px - 1, 0)];
      const hy = hs[Math.max(py - 1, 0) * size + px] - hs[Math.min(py + 1, size - 1) * size + px];
      const shade = Math.max(0.15, Math.min(1.3, 0.75 - ((hx - hy) / (2 * mPerPx)) * 2.5));
      const elev = hi > lo ? (hs[i] - lo) / (hi - lo) : 0.5;
      const k = shade * (0.55 + 0.45 * elev);
      const unsafe =
        slopeDegAt(terr.grid, wx(px), wy(py), legRadiusM) > limits.maxSlopeDeg ||
        roughnessAt(terr.grid, wx(px), wy(py), legRadiusM) > limits.maxRoughnessM ||
        terr.obstacleWithin(wx(px), wy(py), 0.5) > limits.maxRoughnessM;
      img.data[i * 4] = unsafe ? 230 : tint[0] * k;
      img.data[i * 4 + 1] = unsafe ? 70 : tint[1] * k;
      img.data[i * 4 + 2] = unsafe ? 60 : tint[2] * k;
      img.data[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, cx: center.x, cy: center.y, mPerPx, size };
}

export function drawTop(ctx: CanvasRenderingContext2D, sim: Sim, input: SimInput, image: TopImage) {
  const W = ctx.canvas.width;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, W);
  ctx.drawImage(image.canvas, 0, 0, W, W);
  const k = W / image.size / image.mPerPx;
  const toPx = (p: Vec2) => [W / 2 + (p.x - image.cx) * k, W / 2 - (p.y - image.cy) * k] as const;
  const { aim, scan, target } = aimFromEvents(sim, input);

  if (scan) {
    const [x, y] = toPx(scan);
    ctx.strokeStyle = 'rgba(255,204,77,0.6)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, 120 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const [tx, ty] = toPx(target);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tx - 8, ty);
  ctx.lineTo(tx + 8, ty);
  ctx.moveTo(tx, ty - 8);
  ctx.lineTo(tx, ty + 8);
  ctx.stroke();
  if (aim.x !== target.x || aim.y !== target.y) {
    const [ax, ay] = toPx(aim);
    ctx.strokeStyle = '#4cd18a';
    ctx.beginPath();
    ctx.arc(ax, ay, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,179,71,0.8)';
  ctx.beginPath();
  sim.telemetry().samples.forEach((p, i) => {
    const [x, y] = toPx(p);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.stroke();
  const s = sim.state;
  const [lx, ly] = toPx(s.position);
  ctx.fillStyle = s.done ? outcomeColor(s.outcome) : '#ffb347';
  ctx.beginPath();
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `11px ${MONO}`;
  ctx.fillText(`${(image.size * image.mPerPx).toFixed(0)} m across · red = unsafe (slope > 12° or rocks)`, 8, W - 8);
}

export function outcomeColor(o?: string) {
  return o === 'success' ? '#4cd18a' : o === 'hard-landing' ? '#ffcc4d' : '#ff5d5d';
}

// ------------------------------------------------------------------ side view

interface Particle {
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  max: number;
  kind: 'dust' | 'fire' | 'debris';
}

/** Side-on chase view. Keeps its own camera, particles and effects state per flight. */
export function createSideRenderer() {
  let current: Sim | undefined;
  let particles: Particle[] = [];
  let shake = 0;
  let landedAt = 0;
  let crashed = false;
  const cam = { x: 0, zBottom: 0, viewH: 1200, init: false };

  const reset = (sim: Sim) => {
    current = sim;
    particles = [];
    shake = 0;
    landedAt = 0;
    crashed = false;
    cam.init = false;
  };

  return function draw(ctx: CanvasRenderingContext2D, sim: Sim | null, input: SimInput | null, dtReal: number, paused: boolean) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    const air = sim && sim.airDensity > 0.5 ? ['#3a6ea5', '#9cc3e6'] : sim && sim.airDensity > 0 ? ['#3b2420', '#a8735a'] : ['#02040a', '#0b1220'];
    grd.addColorStop(0, air[0]);
    grd.addColorStop(1, air[1]);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    if (!sim || !input) {
      ctx.fillStyle = '#7d8fa3';
      ctx.font = `${16 * dpr}px ${MONO}`;
      ctx.fillText('Choose a setup on the left and press Launch', 24 * dpr, 40 * dpr);
      return;
    }
    if (sim !== current) reset(sim);

    const s = sim.state;
    if (s.done && !landedAt) landedAt = performance.now();
    if (s.outcome === 'crash' && !crashed) {
      crashed = true;
      shake = 1;
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * Math.PI;
        const v = 4 + Math.random() * 22;
        particles.push({ x: s.position.x, z: s.position.z + 1, vx: Math.cos(a) * v, vz: Math.sin(a) * v, life: 0, max: 1 + Math.random() * 1.6, kind: i % 4 === 0 ? 'debris' : 'fire' });
      }
    }

    const ground = sim.terrain.baseHeightAt(s.position.x, s.position.y);
    const wantH = Math.min(1600, Math.max(45, s.altitudeAGL * 2.6 + 25));
    const wantBottom = ground - wantH * 0.18;
    if (!cam.init) Object.assign(cam, { x: s.position.x, zBottom: wantBottom, viewH: wantH, init: true });
    const f = 1 - Math.exp(-dtReal * 3);
    cam.x += (s.position.x - cam.x) * f;
    cam.viewH += (wantH - cam.viewH) * f;
    cam.zBottom += (wantBottom - cam.zBottom) * f;
    const scale = H / cam.viewH;
    const sx = (Math.random() - 0.5) * shake * 18 * dpr;
    const sy = (Math.random() - 0.5) * shake * 18 * dpr;
    shake = Math.max(0, shake - dtReal * 1.2);
    const X = (x: number) => W / 2 + (x - cam.x) * scale + sx;
    const Z = (z: number) => H - (z - cam.zBottom) * scale + sy;

    if (sim.airDensity === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 80; i++) ctx.fillRect((i * 997) % W, (i * 613) % (H * 0.7), 1.5 * dpr, 1.5 * dpr);
    }

    // terrain profile along the lander's y
    ctx.fillStyle = isMarsLike(input.site) ? '#7a4a33' : input.site.body === 'earth' ? '#5c5546' : '#555a63';
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let px = 0; px <= W; px += 2) ctx.lineTo(px, Z(sim.terrain.heightAt(cam.x + (px - W / 2) / scale, s.position.y)));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    const { aim, target } = aimFromEvents(sim, input);
    const mark = (x: number, color: string, label: string) => {
      ctx.strokeStyle = color;
      ctx.setLineDash([6 * dpr, 6 * dpr]);
      ctx.beginPath();
      ctx.moveTo(X(x), 0);
      ctx.lineTo(X(x), H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = `${11 * dpr}px ${MONO}`;
      ctx.fillText(label, X(x) + 4 * dpr, 16 * dpr);
    };
    mark(target.x, 'rgba(255,255,255,0.5)', 'target');
    if (aim.x !== target.x) mark(aim.x, 'rgba(76,209,138,0.8)', 'divert');

    ctx.strokeStyle = 'rgba(255,179,71,0.5)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    sim.telemetry().samples.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))));
    ctx.stroke();

    // particles
    const g = sim.gravity;
    particles = particles.filter((p) => (p.life += dtReal) < p.max);
    for (const p of particles) {
      p.vz -= (p.kind === 'dust' ? g * 0.3 : g) * dtReal;
      if (p.kind === 'dust') p.vx *= 1 - dtReal * 0.8;
      p.x += p.vx * dtReal;
      p.z = Math.max(sim.terrain.heightAt(p.x, s.position.y), p.z + p.vz * dtReal);
      const a = 1 - p.life / p.max;
      const r = Math.max(1.5 * dpr, (p.kind === 'dust' ? 1.2 + p.life * 2 : p.kind === 'fire' ? 0.8 + p.life : 0.3) * scale);
      ctx.fillStyle =
        p.kind === 'dust' ? `rgba(200,190,170,${a * 0.35})` : p.kind === 'fire' ? `rgba(255,${(120 + 100 * a) | 0},40,${a})` : `rgba(60,60,60,${a})`;
      ctx.beginPath();
      ctx.arc(X(p.x), Z(p.z), r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.throttle > 0 && s.altitudeAGL < 30 && !s.done && !paused) {
      const n = Math.ceil((1 - s.altitudeAGL / 30) * 6 * s.throttle * (1 + sim.telemetry().environment.interference.dust));
      for (let i = 0; i < n; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        particles.push({ x: s.position.x, z: ground + 0.2, vx: dir * (6 + Math.random() * 14), vz: Math.random() * 3, life: 0, max: 1.5 + Math.random() * 1.5, kind: 'dust' });
      }
    }

    if (s.outcome !== 'crash') drawLander(ctx, sim, X(s.position.x), Z(s.position.z), Math.max(scale, 3.2 * dpr), landedAt, dpr);

    const barM = niceMetres(cam.viewH / 6);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(16 * dpr, H - 20 * dpr, barM * scale, 2 * dpr);
    ctx.font = `${11 * dpr}px ${MONO}`;
    ctx.fillText(`${barM} m`, 16 * dpr, H - 26 * dpr);
    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = `${22 * dpr}px ${MONO}`;
      ctx.fillText('PAUSED', W / 2 - 45 * dpr, H / 2);
    }
  };
}

function drawLander(ctx: CanvasRenderingContext2D, sim: Sim, x: number, z: number, px: number, landedAt: number, dpr: number) {
  const s = sim.state;
  let angle = s.tiltX;
  if (s.outcome === 'tip-over') {
    const downhill = gradientAt(sim.terrain, s.position.x, s.position.y, sim.lander.legRadiusM).x > 0 ? -1 : 1;
    angle += downhill * 1.35 * Math.min(1, (performance.now() - landedAt) / 900);
  }
  ctx.save();
  ctx.translate(x, z);
  ctx.rotate(angle);
  if (s.throttle > 0 && !s.done) {
    const len = (2 + s.throttle * 9) * px * (0.85 + Math.random() * 0.3);
    const fl = ctx.createLinearGradient(0, -1.2 * px, 0, len);
    fl.addColorStop(0, 'rgba(255,240,200,0.95)');
    fl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.moveTo(-0.7 * px, -1.2 * px);
    ctx.lineTo(0.7 * px, -1.2 * px);
    ctx.lineTo(0, len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#c9ced6';
  ctx.lineWidth = Math.max(1, 0.25 * px);
  ctx.beginPath();
  ctx.moveTo(-1.2 * px, -2 * px);
  ctx.lineTo(-2.5 * px, 0);
  ctx.moveTo(1.2 * px, -2 * px);
  ctx.lineTo(2.5 * px, 0);
  ctx.moveTo(-3 * px, 0);
  ctx.lineTo(-2 * px, 0);
  ctx.moveTo(2 * px, 0);
  ctx.lineTo(3 * px, 0);
  ctx.stroke();
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(-1.8 * px, -3.2 * px, 3.6 * px, 2 * px);
  ctx.fillStyle = '#b8bec8';
  ctx.fillRect(-1.3 * px, -5.4 * px, 2.6 * px, 2.2 * px);
  ctx.fillStyle = '#1b2533';
  ctx.fillRect(-0.6 * px, -4.9 * px, 1.2 * px, 0.8 * px);
  if (s.outcome === 'success' && Math.floor(performance.now() / 400) % 2 === 0) {
    ctx.fillStyle = '#4cd18a';
    ctx.beginPath();
    ctx.arc(0, -6 * px, 0.6 * px + 2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function niceMetres(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((m) => m * p).find((m) => m >= v) ?? 10 * p;
}
