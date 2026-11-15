/**
 * How each hazard sensor shows what it saw, drawn over the terrain in the live 3D view.
 *
 * Nothing here decides anything. The cells come from Sim.hazardMap, which classifies the sensor's
 * own noisy view of the ground with the autopilot's footprint test and margins, and the target
 * marker follows Sim.aim. This module only chooses how a sensor's result looks:
 *
 *   dots     lidar, prototype camera: dots revealed as the scan sweeps outwards; unsafe slopes and
 *            rough patches are larger dots in their own colours
 *   raster   laser 3D imager: a crisp mosaic of small tiles laid down by a scan line, over its
 *            short range only
 *   outline  hazard camera: only the edges of the hazards it found, fading as glare lowers its
 *            detection quality
 *   drape    terrain-relative navigation: a broad translucent wash over its whole range
 *   none     crew window and the sensors with no hazard map (radar, Doppler lidar, none)
 */
import * as THREE from "three";
import type { HazardCell, HazardSensorId } from "../sim/src/index.ts";

export type OverlayStyle = "dots" | "raster" | "outline" | "drape" | "none";

export const OVERLAY_STYLE: Record<HazardSensorId, OverlayStyle> = {
  lidar: "dots", camera: "dots", none: "none",
  "crew-window": "none", "landing-radar": "none", "doppler-lidar": "none",
  "flash-lidar": "raster", "hazard-camera": "outline", "terrain-nav": "drape",
};

export const COLOURS = { safe: 0x5cff9a, slope: 0xff4a3a, rough: 0xffb02e, raster: 0xa8f4ff, drape: 0x3fc8ff, marker: 0xffd23a };

/** Grid spacing the overlay asks the sim for: fine enough to read, few enough cells to draw at once. */
export function overlayStep(style: OverlayStyle, radiusM: number, cellM: number) {
  if (style === "raster") return Math.max(cellM * 2, radiusM / 30);
  if (style === "outline") return Math.max(cellM * 2, radiusM / 36);
  if (style === "drape") return Math.max(cellM * 2, radiusM / 40);
  return Math.max(4, radiusM / 22);
}

export interface OverlayInput {
  cells: HazardCell[];
  /** Grid spacing of the cells, m. */
  step: number;
  /** Centre of the scan, sim coordinates. */
  center: { x: number; y: number };
  radiusM: number;
  /** 0..1, how well the sensor sees in this glare (Sim.sensor.quality). */
  quality: number;
  /** Sim (x east, y north) to a point on the drawn terrain, `lift` metres above it. */
  place(x: number, y: number, lift: number): THREE.Vector3;
}

export interface SensorOverlay {
  style: OverlayStyle;
  root: THREE.Group;
  /** Cells by class, for tests and readouts. */
  counts: { safe: number; slope: number; rough: number };
  /** `t` seconds since the scan began. */
  update(t: number): void;
  dispose(): void;
}

const kind = (c: HazardCell) => (c.safe ? "safe" : c.slopeHazard ? "slope" : "rough") as "safe" | "slope" | "rough";

function countCells(cells: HazardCell[]) {
  const counts = { safe: 0, slope: 0, rough: 0 };
  for (const c of cells) counts[kind(c)]++;
  return counts;
}

/** A thin circle on the terrain marking how far the sensor reached. */
function coverageRing(input: OverlayInput, colour: number, opacity: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    pts.push(input.place(input.center.x + Math.cos(a) * input.radiusM, input.center.y + Math.sin(a) * input.radiusM, 1.2));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false, fog: false }));
}

function disposeAll(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
  });
}

export function buildOverlay(style: OverlayStyle, input: OverlayInput): SensorOverlay {
  const root = new THREE.Group(), counts = countCells(input.cells);
  const result = (update: (t: number) => void): SensorOverlay => ({ style, root, counts, update, dispose: () => disposeAll(root) });
  if (style === "none" || !input.cells.length) return result(() => {});
  if (style === "dots") return dots(root, input, result);
  if (style === "raster") return raster(root, input, result);
  if (style === "outline") return outline(root, input, result);
  return drape(root, input, result);
}

type Finish = (update: (t: number) => void) => SensorOverlay;

/** Lidar: dots appear outwards from the centre over 1.5 s; hazards are bigger and coloured by cause. */
function dots(root: THREE.Group, input: OverlayInput, finish: Finish) {
  const trust = 0.45 + 0.55 * input.quality;
  const layers = (["safe", "slope", "rough"] as const).map((k) => {
    const cells = input.cells.filter((c) => kind(c) === k)
      .map((c) => ({ c, d: Math.hypot(c.x - input.center.x, c.y - input.center.y) })).sort((a, b) => a.d - b.d);
    const pos = new Float32Array(cells.length * 3);
    cells.forEach(({ c }, i) => { const p = input.place(c.x, c.y, 0.7); pos.set([p.x, p.y, p.z], i * 3); });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setDrawRange(0, 0);
    const m = new THREE.PointsMaterial({ color: COLOURS[k], size: k === "safe" ? 3.5 : 7, sizeAttenuation: false, transparent: true, opacity: (k === "safe" ? 0.8 : 1) * trust, depthWrite: false, fog: false });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = k === "safe" ? 1 : 2; root.add(pts);
    return { pts, m, d: cells.map((x) => x.d), base: m.opacity };
  });
  const ring = coverageRing(input, 0x7fdcff, 0.35 * trust); root.add(ring);
  return finish((t) => {
    const reach = input.radiusM * Math.min(1, (t / 1.5) ** 2);
    const fade = t < 7 ? 1 : Math.max(0.35, 1 - (t - 7) * 0.3);
    for (const l of layers) { l.pts.geometry.setDrawRange(0, upTo(l.d, reach)); l.m.opacity = l.base * fade; }
  });
}

/** Laser imager: square tiles sized to the grid, laid down by a bright line sweeping across in 0.9 s. */
function raster(root: THREE.Group, input: OverlayInput, finish: Finish) {
  const sorted = input.cells.map((c) => ({ c, p: input.place(c.x, c.y, 0.45) })).sort((a, b) => a.p.x - b.p.x);
  // one flat square tile per cell, sized to the grid in metres: a crisp mosaic at any distance
  const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m, sorted.length);
  const colour = new THREE.Color(), matrix = new THREE.Matrix4(), size = new THREE.Vector3(input.step * 0.9, 1, input.step * 0.9), still = new THREE.Quaternion();
  sorted.forEach(({ c, p }, i) => {
    tiles.setMatrixAt(i, matrix.compose(p, still, size));
    tiles.setColorAt(i, colour.setHex(c.safe ? COLOURS.raster : c.slopeHazard ? COLOURS.slope : COLOURS.rough).multiplyScalar(c.safe ? 0.6 : 1));
  });
  tiles.count = 0; tiles.frustumCulled = false; tiles.renderOrder = 1; root.add(tiles);
  const xs = sorted.map((s) => s.p.x), x0 = xs[0], x1 = xs[xs.length - 1];
  const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, fog: false }));
  line.frustumCulled = false; root.add(line);
  const ring = coverageRing(input, 0xe6fbff, 0.8); root.add(ring);
  const centreScene = input.place(input.center.x, input.center.y, 0);
  return finish((t) => {
    const u = Math.min(1, t / 0.9), at = x0 + (x1 - x0) * u;
    tiles.count = upTo(xs, at);
    line.visible = u < 1;
    if (line.visible) {
      // the scan line spans the disc at the current sweep position
      // (scene x runs with sim x, so the line is at sim x = centre + offset, spanning sim y)
      const offset = at - centreScene.x, half = Math.sqrt(Math.max(0, input.radiusM ** 2 - offset ** 2)), pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) pts.push(input.place(input.center.x + offset, input.center.y - half + (2 * half * i) / 24, 0.9));
      line.geometry.dispose(); line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }
    m.opacity = t < 10 ? 0.6 : Math.max(0.35, 0.6 - (t - 10) * 0.1);
  });
}

/** Hazard camera: the outline of each hazard patch, as bright as the glare lets it see. */
function outline(root: THREE.Group, input: OverlayInput, finish: Finish) {
  const s = input.step, key = (i: number, j: number) => `${i},${j}`;
  const ij = (c: HazardCell) => [Math.round((c.x - input.center.x) / s), Math.round((c.y - input.center.y) / s)] as const;
  const hazards = new Map<string, HazardCell>();
  for (const c of input.cells) if (!c.safe) { const [i, j] = ij(c); hazards.set(key(i, j), c); }
  const pos: number[] = [], col: number[] = [], colour = new THREE.Color();
  const corner = (c: HazardCell, sx: number, sy: number) => input.place(c.x + (sx * s) / 2, c.y + (sy * s) / 2, 0.9);
  for (const c of hazards.values()) {
    const [i, j] = ij(c);
    colour.setHex(c.slopeHazard ? COLOURS.slope : COLOURS.rough);
    // an edge wherever a flagged patch ends: against ground the camera judged safe, or at the edge
    // of its view. A camera that glare has blinded flags everything, so it outlines its whole view.
    for (const [di, dj, a, b] of [[1, 0, [1, -1], [1, 1]], [-1, 0, [-1, -1], [-1, 1]], [0, 1, [-1, 1], [1, 1]], [0, -1, [-1, -1], [1, -1]]] as const) {
      if (hazards.has(key(i + di, j + dj))) continue;
      const p = corner(c, a[0], a[1]), q = corner(c, b[0], b[1]);
      pos.push(p.x, p.y, p.z, q.x, q.y, q.z); col.push(colour.r, colour.g, colour.b, colour.r, colour.g, colour.b);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const visible = Math.max(0.08, input.quality);
  const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const edges = new THREE.LineSegments(g, m); edges.frustumCulled = false; root.add(edges);
  const ring = coverageRing(input, 0xffffff, 0.12 * visible); root.add(ring);
  return finish((t) => { m.opacity = visible * Math.min(1, t / 0.8) * (t < 12 ? 1 : Math.max(0.5, 1 - (t - 12) * 0.15)); });
}

/** Terrain navigation: a broad wash over the whole range, hazards stronger, fading in over 1.5 s. */
function drape(root: THREE.Group, input: OverlayInput, finish: Finish) {
  const s = input.step, n = Math.round(input.radiusM / s), size = 2 * n + 1;
  const grid = new Map<string, HazardCell>();
  for (const c of input.cells) grid.set(`${Math.round((c.x - input.center.x) / s)},${Math.round((c.y - input.center.y) / s)}`, c);
  const pos = new Float32Array(size * size * 3), col = new Float32Array(size * size * 4), index: number[] = [], colour = new THREE.Color();
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const v = (j + n) * size + (i + n), x = input.center.x + i * s, y = input.center.y + j * s, c = grid.get(`${i},${j}`);
    const p = input.place(x, y, 2.2); pos.set([p.x, p.y, p.z], v * 3);
    // feathered edge, so the wash fades out at the edge of the range rather than stopping on a line
    const edge = Math.max(0, Math.min(1, (input.radiusM - Math.hypot(i * s, j * s)) / (3 * s)));
    colour.setHex(!c || c.safe ? COLOURS.drape : c.slopeHazard ? COLOURS.slope : COLOURS.rough);
    col.set([colour.r, colour.g, colour.b, (!c ? 0 : c.safe ? 0.22 : 0.6) * edge], v * 4);
    if (i < n && j < n) { const a = v, b = v + 1, d = v + size, e = v + size + 1; index.push(a, d, b, b, d, e); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 4)); g.setIndex(index);
  const visible = 0.35 + 0.65 * input.quality;
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 1; root.add(mesh);
  const ring = coverageRing(input, COLOURS.drape, 0.5 * visible); root.add(ring);
  return finish((t) => { m.opacity = visible * Math.min(1, t / 1.5); });
}

/** How many of the sorted values are at most `limit`. */
function upTo(sorted: number[], limit: number) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= limit) lo = mid + 1; else hi = mid; }
  return lo;
}

/**
 * The autopilot's chosen landing spot: a gold ring with a beam and a diamond above it, the same
 * for every sensor that maps the ground. It is placed each frame at Sim.aim.
 */
export function buildSiteMarker() {
  const group = new THREE.Group(), mat = (opacity: number) => new THREE.MeshBasicMaterial({ color: COLOURS.marker, transparent: true, opacity, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), mat(0.95));
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 32).rotateX(-Math.PI / 2), mat(0.95));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 6, 8).translate(0, 3, 0), mat(0.55));
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), mat(1)); diamond.position.y = 6.4;
  group.add(ring, inner, beam, diamond); group.visible = false; group.renderOrder = 3;
  return {
    group,
    /** Stand the marker on the ground at `at`, sized for a camera `distance` away. */
    place(at: THREE.Vector3, distance: number, t: number) {
      group.position.copy(at); group.scale.setScalar(Math.max(3, Math.min(60, distance * 0.03)));
      diamond.rotation.y = t * 1.6; diamond.position.y = 6.4 + Math.sin(t * 3) * 0.15;
    },
    dispose: () => disposeAll(group),
  };
}
