import * as THREE from "three";
import type { EnvLook } from "./presets";
import { packCentre, type TerrainPack } from "./terrainPack";

const SIZE = 4800, SEGS = 320, PAD_INNER = 16, PAD_OUTER = 80;

function hash(ix: number, iz: number, seed: number) {
  const s = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, z: number, seed: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number, seed: number) {
  let f = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 4; o++) { f += amp * noise(x * freq, z * freq, seed + o * 13); amp *= 0.5; freq *= 2.1; }
  return f / 0.9375;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export interface Terrain { group: THREE.Group; heightAt(x: number, z: number): number; }

function colorize(geo: THREE.BufferGeometry, look: EnvLook, seed: number, plain?: (i: number) => boolean) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position as THREE.BufferAttribute, nor = geo.attributes.normal as THREE.BufferAttribute;
  const cA = new THREE.Color(look.ground), cB = new THREE.Color(look.groundDark), c = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = plain?.(i) ? 0.12 : Math.min(1, Math.max(0, (1 - nor.getY(i)) * 3.2 + (noise(pos.getX(i) / 40, pos.getZ(i) / 40, seed + 3) - 0.5) * 0.5));
    c.copy(cA).lerp(cB, k);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function scatterRocks(group: THREE.Group, look: EnvLook, seed: number, heightAt: (x: number, z: number) => number) {
  const N = 160;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: look.rock, flatShading: true, roughness: 1 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const ang = hash(i, 1, seed) * Math.PI * 2, r = 14 + Math.pow(hash(i, 2, seed), 1.6) * 420;
    const sc = 0.25 + Math.pow(hash(i, 3, seed), 3) * 3.2;
    p.set(Math.cos(ang) * r, 0, Math.sin(ang) * r); p.y = heightAt(p.x, p.z) + sc * 0.25;
    q.setFromEuler(new THREE.Euler(hash(i, 4, seed) * 6, hash(i, 5, seed) * 6, hash(i, 6, seed) * 6));
    s.set(sc, sc * (0.5 + hash(i, 7, seed) * 0.6), sc * (0.7 + hash(i, 8, seed) * 0.6));
    rocks.setMatrixAt(i, m.compose(p, q, s));
  }
  group.add(rocks);
}

const groundMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });

/** An extra rock to draw, in scene metres (used for synthetic test hazards). */
export interface Boulder { x: number; z: number; r: number; h: number; }

/** Surface materials of a site, used to paint a terrain pack. Colours are sRGB hex. */
export interface SiteStyle {
  plain: string; floor: string; playa: string; ejecta: string; dune: string; scree: string; cliff: string; shrub: string;
  shrubs: number;        // 0..1 shrub cover on the plain
}

/**
 * Kilbourne Hole, from published descriptions (Wikipedia; NM Bureau of Geology field guide):
 * dark basalt cliffs about 12 m high round the rim except in the south-west, basalt-block scree
 * below them, tan surge beds over a reddish unit in the walls, sand dunes about 30 m high on the
 * east side, a dry lakebed on the floor, creosote desert all round. The pack has no imagery, so
 * these are assigned from elevation and slope. It is an interpretation, not a land-cover map.
 */
export const KILBOURNE_STYLE: SiteStyle = {
  plain: "#b39a76", floor: "#b08d68", playa: "#d8cdb6", ejecta: "#c9b38c", dune: "#d6bd8c",
  scree: "#8a6a52", cliff: "#5f4b40", shrub: "#59603f", shrubs: 0.55,
};

const srgb = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** Samples of elevation and slope over a pack, plus the levels the material rules use. */
function packField(pack: TerrainPack) {
  const { rows, columns, spacing_m: step } = pack.manifest.grid, h = pack.heights;
  const slope = new Float32Array(rows * columns);
  const at = (r: number, c: number) => h[Math.min(rows - 1, Math.max(0, r)) * columns + Math.min(columns - 1, Math.max(0, c))];
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const dx = (at(r, c + 1) - at(r, c - 1)) / (2 * step), dz = (at(r + 1, c) - at(r - 1, c)) / (2 * step);
    slope[r * columns + c] = Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
  }
  const sorted = Float32Array.from(h).sort();
  const q = (f: number) => sorted[Math.floor(f * (sorted.length - 1))];
  const bil = (a: Float32Array, px: number, pz: number) => {
    const fx = Math.min(columns - 1.001, Math.max(0, px / step)), fz = Math.min(rows - 1.001, Math.max(0, pz / step));
    const c = Math.floor(fx), r = Math.floor(fz), tx = fx - c, tz = fz - r, i = r * columns + c;
    return (a[i] * (1 - tx) + a[i + 1] * tx) * (1 - tz) + (a[i + columns] * (1 - tx) + a[i + columns + 1] * tx) * tz;
  };
  return { W: (columns - 1) * step, D: (rows - 1) * step, plain: q(0.6), low: q(0.01),
    elev: (px: number, pz: number) => bil(h, px, pz), slope: (px: number, pz: number) => bil(slope, px, pz) };
}
type Field = ReturnType<typeof packField>;

/** Material weights at a pack position: how much cliff, scree, playa, crater floor and raised rim. */
function materialAt(f: Field, px: number, pz: number, seed: number) {
  const e = f.elev(px, pz), s = f.slope(px, pz), n = fbm(px / 90, pz / 90, seed + 21) - 0.5;
  // The 30 m grid smears a 12 m cliff over a wide band, so only the steepest cells get cliff colour.
  const cliff = smooth(23, 33, s + n * 5);
  const scree = smooth(11, 23, s + n * 4) * (1 - cliff);
  const inside = smooth(f.plain - 8, f.plain - 26, e);
  const playa = smooth(f.low + 5.5, f.low + 2, e + n * 3) * (1 - scree) * (1 - cliff);
  const raised = smooth(f.plain + 5, f.plain + 13, e + n * 4) * (1 - cliff);
  return { cliff, scree, inside, playa, raised, east: smooth(f.W * 0.45, f.W * 0.6, px), n };
}

/** Paints a square of the pack (centre cx, cz, half-size `half`, in pack metres) to a texture. */
function paintPack(f: Field, st: SiteStyle, cx: number, cz: number, half: number, px: number, seed: number, fadeEdge: boolean) {
  const it = paintPackSteps(f, st, cx, cz, half, px, seed, fadeEdge);
  let r = it.next(); while (!r.done) r = it.next();
  return r.value;
}

/** paintPack in steps of a few rows, so it can run in the background between animation frames. */
function* paintPackSteps(f: Field, st: SiteStyle, cx: number, cz: number, half: number, px: number, seed: number, fadeEdge: boolean): Generator<void, HTMLCanvasElement> {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d")!, img = ctx.createImageData(px, px), d = img.data;
  const C = { plain: srgb(st.plain), floor: srgb(st.floor), playa: srgb(st.playa), ejecta: srgb(st.ejecta), dune: srgb(st.dune),
    scree: srgb(st.scree), cliff: srgb(st.cliff), shrub: srgb(st.shrub) };
  const mpp = (2 * half) / px, col = [0, 0, 0];
  const mix = (to: number[], w: number) => { for (let k = 0; k < 3; k++) col[k] += (to[k] - col[k]) * w; };
  for (let j = 0; j < px; j++) { if ((j & 3) === 3) yield; for (let i = 0; i < px; i++) {
    const X = cx - half + (i + 0.5) * mpp, Z = cz - half + (j + 0.5) * mpp;
    const m = materialAt(f, X, Z, seed);
    col[0] = C.plain[0]; col[1] = C.plain[1]; col[2] = C.plain[2];
    mix(C.floor, m.inside); mix(C.playa, m.playa);
    mix(m.east > 0.5 ? C.dune : C.ejecta, m.raised * (0.6 + 0.4 * Math.abs(m.east - 0.5) * 2));
    mix(C.scree, m.scree * 0.85); mix(C.cliff, m.cliff);
    // shrubs: dots where the texture is fine enough to show them, a darker tint where it is not
    const open = (1 - m.cliff) * (1 - m.playa) * (1 - m.raised * 0.7) * st.shrubs * (m.inside > 0.5 ? 0.5 : 1);
    if (mpp < 1.6) {
      const gx = Math.floor(X / 5), gz = Math.floor(Z / 5), hh = hash(gx, gz, seed + 40);
      if (hh < open * 0.22) {
        const sx = (gx + 0.2 + 0.6 * hash(gx, gz, seed + 41)) * 5, sz = (gz + 0.2 + 0.6 * hash(gx, gz, seed + 42)) * 5;
        const rr = 0.7 + 1.1 * hash(gx, gz, seed + 43), dd = Math.hypot(X - sx, Z - sz);
        if (dd < rr) mix(C.shrub, 0.85 * smooth(rr, rr * 0.5, dd));
      }
    } else if (hash(i, j, seed + 44) < open * 0.2) mix(C.shrub, 0.45);
    // basalt blocks on the scree, grain everywhere
    if (m.scree > 0.25 && hash(i * 3, j * 7, seed + 45) < m.scree * 0.3) mix(C.cliff, 0.5);
    const g = 0.9 + 0.2 * (fbm(X / 37, Z / 37, seed + 46) - 0.5) * 2 * 0.6 + (hash(i, j, seed + 47) - 0.5) * 0.07;
    let gg = g;
    if (fadeEdge) {                                    // even colour at the border, so the apron beyond it is uniform
      const w = 1 - smooth(40, 260, Math.min(X, Z, f.W - X, f.D - Z));
      mix(C.plain, w); gg = g + (0.95 - g) * w;
    }
    const o = (j * px + i) * 4;
    d[o] = Math.min(255, col[0] * gg); d[o + 1] = Math.min(255, col[1] * gg); d[o + 2] = Math.min(255, col[2] * gg); d[o + 3] = 255;
  } }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
const toTexture = (canvas: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const overviewCache = new Map<string, HTMLCanvasElement>();      // the whole-pack paint does not depend on the landing point
// The fine patch round the landing point is the slowest part to build (most of a second, several
// on a Pi). The opening and the live descent build the same one back to back, so it is kept: the
// descent then starts without a long black pause after the opening.
const patchCache = new Map<string, HTMLCanvasElement>();
const styleOf = (pack: TerrainPack) => (pack.manifest.id.startsWith("kilbourne") ? KILBOURNE_STYLE : null);
const fieldCache = new WeakMap<TerrainPack, Field>();
const fieldOf = (pack: TerrainPack) => { let f = fieldCache.get(pack); if (!f) { f = packField(pack); fieldCache.set(pack, f); } return f; };
const patchKey = (pack: TerrainPack, seed: number, L: { x: number; z: number }) => `${pack.manifest.id}:${seed}:${L.x.toFixed(1)}:${L.z.toFixed(1)}`;
const keepPatch = (key: string, c: HTMLCanvasElement) => {
  patchCache.delete(key); patchCache.set(key, c);
  while (patchCache.size > 4) patchCache.delete(patchCache.keys().next().value!);      // a few sites at most
};

/**
 * Paints a site's terrain ahead of time, a few milliseconds per frame, so the cutscene that later
 * builds it starts at once instead of freezing for seconds. Call it while an earlier scene plays.
 * `landing` is in pack metres, as for buildTerrain; the seed must match the scene's (7 by default).
 */
export async function prepareTerrain(pack: TerrainPack, landing: { x: number; z: number }, seed = 7, signal?: AbortSignal) {
  const style = styleOf(pack);
  if (!style) return;                              // only painted sites are slow to build
  const field = fieldOf(pack), { rows, columns, spacing_m: step } = pack.manifest.grid;
  const W = (columns - 1) * step, D = (rows - 1) * step;
  const run = async (steps: Generator<void, HTMLCanvasElement>) => {
    for (;;) {
      const until = performance.now() + 4;
      let r = steps.next();
      while (!r.done && performance.now() < until) r = steps.next();
      if (r.done) return r.value;
      await new Promise((ok) => setTimeout(ok, 12));
      if (signal?.aborted) return null;
    }
  };
  const oKey = `${pack.manifest.id}:${seed}`;
  if (!overviewCache.has(oKey)) { const c = await run(paintPackSteps(field, style, W / 2, D / 2, W / 2, 1024, seed, true)); if (c) overviewCache.set(oKey, c); else return; }
  const pKey = patchKey(pack, seed, landing);
  if (!patchCache.has(pKey)) { const c = await run(paintPackSteps(field, style, landing.x, landing.z, 400, 768, seed, false)); if (c) keepPatch(pKey, c); }
}

/**
 * Terrain with the landing point at the scene origin (+X east, +Y up, +Z south).
 *
 * With a terrain pack: real elevation at 1:1 scale over the whole pack, plus a finer patch around
 * the landing point that adds about a metre of procedural detail (the source is a 30 m grid).
 * A pack with a known site style is painted with that site's materials.
 * Without a pack: a procedural landscape with a flat pad; an elevation slice shapes its relief.
 */
export function buildTerrain(look: EnvLook, elevation: number[] | undefined, seed: number,
                             pack?: TerrainPack, landing?: { x: number; z: number }, boulders: Boulder[] = []): Terrain {
  const group = new THREE.Group();
  if (pack) {
    const { rows, columns, spacing_m: step } = pack.manifest.grid;
    const L = landing ?? packCentre(pack);
    const W = (columns - 1) * step, D = (rows - 1) * step, PATCH = 400, APRON = 9000;
    const raw = (px: number, pz: number) => pack.heightAt(Math.min(Math.max(px, 0), W), Math.min(Math.max(pz, 0), D)) ?? 0;
    const ref = raw(L.x, L.z);
    const style = styleOf(pack);
    const field = fieldOf(pack);
    const heightAt = (x: number, z: number) => {
      const fade = 1 - smooth(PATCH * 0.65, PATCH * 0.92, Math.max(Math.abs(x), Math.abs(z)));
      return raw(L.x + x, L.z + z) - ref
        + ((fbm(x / 23, z / 23, seed + 5) - 0.5) * 1.6 + (fbm(x / 6, z / 6, seed + 9) - 0.5) * 0.25) * fade;
    };
    const mat = (tex: THREE.Texture | null) => tex
      ? new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }) : groundMat();
    // fine patch around the landing point
    const fine = new THREE.PlaneGeometry(PATCH * 2, PATCH * 2, 200, 200);
    fine.rotateX(-Math.PI / 2);
    const fp = fine.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fp.count; i++) fp.setY(i, heightAt(fp.getX(i), fp.getZ(i)));
    if (style) fine.computeVertexNormals(); else colorize(fine, look, seed);
    let patch: HTMLCanvasElement | null = null;
    if (style) {
      const key = patchKey(pack, seed, L);
      patch = patchCache.get(key) ?? paintPack(field, style, L.x, L.z, PATCH, 768, seed, false);
      keepPatch(key, patch);
    }
    group.add(new THREE.Mesh(fine, mat(patch ? toTexture(patch) : null)));
    // whole pack at source resolution, with an apron out to the horizon so the map has no visible edge
    const R = rows + 2, C = columns + 2;
    const pos = new Float32Array(R * C * 3), uv = new Float32Array(R * C * 2);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const px = c === 0 ? -APRON : c === C - 1 ? W + APRON : (c - 1) * step;
      const pz = r === 0 ? -APRON : r === R - 1 ? D + APRON : (r - 1) * step;
      const x = px - L.x, z = pz - L.z;
      const inside = Math.abs(x) < PATCH && Math.abs(z) < PATCH;
      pos.set([x, raw(px, pz) - ref - (inside ? 0.6 : 0), z], (r * C + c) * 3);
      uv.set([Math.min(1, Math.max(0, px / W)), 1 - Math.min(1, Math.max(0, pz / D))], (r * C + c) * 2);
    }
    const idx: number[] = [];
    const covered = (i: number) => Math.abs(pos[i * 3]) < PATCH - step && Math.abs(pos[i * 3 + 2]) < PATCH - step;
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const a = r * C + c, b = a + 1, d = a + C, e = d + 1;
      if (covered(a) && covered(b) && covered(d) && covered(e)) continue;      // under the fine patch
      idx.push(a, d, b, b, d, e);
    }
    const coarse = new THREE.BufferGeometry();
    coarse.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    coarse.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    coarse.setIndex(idx);
    if (style) {
      coarse.computeVertexNormals();
      const nr = coarse.attributes.normal as THREE.BufferAttribute;        // flat lighting on the apron
      for (let i = 0; i < R * C; i++) { const r = Math.floor(i / C), c = i % C; if (r < 2 || c < 2 || r > R - 3 || c > C - 3) nr.setXYZ(i, 0, 1, 0); }
    }
    else colorize(coarse, look, seed, (i) => { const r = Math.floor(i / C), c = i % C; return r < 2 || c < 2 || r > R - 3 || c > C - 3; });
    let overview: HTMLCanvasElement | null = null;
    if (style) {
      const key = `${pack.manifest.id}:${seed}`;
      overview = overviewCache.get(key) ?? paintPack(field, style, W / 2, D / 2, W / 2, 1024, seed, true);
      overviewCache.set(key, overview);
    }
    group.add(new THREE.Mesh(coarse, mat(overview ? toTexture(overview) : null)));

    if (style) {
      // shrubs and basalt blocks near the landing point, placed by the same material rules as the paint
      const shrubs: THREE.Matrix4[] = [], blocks: THREE.Matrix4[] = [];
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
      for (let i = 0; i < 2600; i++) {
        const x = (hash(i, 1, seed) - 0.5) * 2 * 330, z = (hash(i, 2, seed) - 0.5) * 2 * 330;
        if (Math.hypot(x, z) < 7) continue;
        const m = materialAt(field, L.x + x, L.z + z, seed), u = hash(i, 3, seed);
        const open = (1 - m.cliff) * (1 - m.playa) * (1 - m.raised * 0.7) * style.shrubs * (m.inside > 0.5 ? 0.5 : 1);
        q.setFromEuler(new THREE.Euler(hash(i, 4, seed) * 6, hash(i, 5, seed) * 6, hash(i, 6, seed) * 6));
        if (u < m.scree * 0.5 + m.cliff * 0.25) {
          const s0 = 0.4 + Math.pow(hash(i, 7, seed), 2.5) * 2.6;
          p.set(x, heightAt(x, z) + s0 * 0.3, z); sc.set(s0, s0 * (0.6 + 0.5 * hash(i, 8, seed)), s0 * (0.7 + 0.5 * hash(i, 9, seed)));
          blocks.push(m4.compose(p, q, sc).clone());
        } else if (u < open * 0.6) {
          const s0 = 0.5 + hash(i, 7, seed) * 0.9;
          p.set(x, heightAt(x, z) + s0 * 0.35, z); sc.set(s0, s0 * 0.6, s0);
          shrubs.push(m4.compose(p, q, sc).clone());
        }
      }
      const inst = (geo: THREE.BufferGeometry, color: string, list: THREE.Matrix4[]) => {
        if (!list.length) return;
        const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }), list.length);
        list.forEach((mm, i) => mesh.setMatrixAt(i, mm)); group.add(mesh);
      };
      inst(new THREE.IcosahedronGeometry(1, 0), style.shrub, shrubs);
      inst(new THREE.DodecahedronGeometry(1, 0), style.cliff, blocks);
    } else scatterRocks(group, look, seed, heightAt);

    if (boulders.length) {
      const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: style?.cliff ?? look.rock, flatShading: true, roughness: 1 }), boulders.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      boulders.forEach((bd, i) => {
        q.setFromEuler(new THREE.Euler(hash(i, 11, seed) * 6, hash(i, 12, seed) * 6, hash(i, 13, seed) * 6));
        mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(bd.x, heightAt(bd.x, bd.z) + bd.h * 0.35, bd.z), q, new THREE.Vector3(bd.r, bd.h * 0.9, bd.r)));
      });
      group.add(mesh);
    }
    return { group, heightAt };
  }

  let profile: number[] | null = null;
  if (elevation && elevation.length >= 2) {
    const min = Math.min(...elevation), max = Math.max(...elevation), range = max - min || 1;
    profile = elevation.map((e) => (e - min) / range - 0.5);
  }
  const prof = (x: number) => {
    if (!profile) return 0;
    const f = Math.min(0.9999, Math.max(0, x / SIZE + 0.5)) * (profile.length - 1);
    const i = Math.floor(f);
    return profile[i] + (profile[i + 1] - profile[i]) * (f - i);
  };
  const p0 = prof(0);
  const heightAt = (x: number, z: number) => {
    const d = Math.hypot(x, z);
    const far = 1 + d / 260;                                    // bigger relief towards the horizon
    const raw = (fbm(x / 170, z / 170, seed) - 0.5) * 2 * look.relief * far
      + (prof(x) - p0) * look.relief * 2.4
      + (fbm(x / 23, z / 23, seed + 5) - 0.5) * 2.2;
    return raw * smooth(PAD_INNER, PAD_OUTER, d) + (fbm(x / 6, z / 6, seed + 9) - 0.5) * 0.25;
  };
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  colorize(geo, look, seed);
  group.add(new THREE.Mesh(geo, groundMat()));
  scatterRocks(group, look, seed, heightAt);
  return { group, heightAt };
}
