import * as T from 'three';
import type { TerrainProfile } from '../../lib/types';

export const EARTH_METRES = 6_371_000;
export const EARTH_RADIUS = 1.5;
export const METRE_SCALE = EARTH_RADIUS / EARTH_METRES;
export const EARTH_CENTRE = new T.Vector3(0, -.35, 0);

export function globePoint(lat: number, lon: number, radius: number) {
  const p = T.MathUtils.degToRad(lat), t = T.MathUtils.degToRad(lon);
  return new T.Vector3(radius * Math.cos(p) * Math.cos(t), radius * Math.sin(p), -radius * Math.cos(p) * Math.sin(t));
}

export function surfaceFrame(lat: number, lon: number) {
  const up = globePoint(lat, lon, 1), east = globePoint(0, lon + 90, 1);
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(east, up, new T.Vector3().crossVectors(east, up)));
}

/** Smooth value noise in [-1, 1]. Deterministic, so a site always gets the same surroundings. */
function noise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return T.MathUtils.lerp(T.MathUtils.lerp(hash(xi, zi), hash(xi + 1, zi), u), T.MathUtils.lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v);
}

/** Real DEM inside its footprint; curved, unmeasured Earth context beyond it.
 * Shared equirectangular imagery keeps the local cap registered with the globe.
 * The surroundings carry on from the patch's edge heights into generated ground that is as
 * rough as the measured land along that edge, with the same tint, so the patch sits in
 * terrain of its own character instead of on a featureless plain. Landmarks inside the
 * patch (a crater, a cone) are never repeated outside it. Illustrative, not data.
 * This display geometry is never passed to the physics engine.
 */
export function earthSurface(profile: TerrainProfile, lat: number, lon: number) {
  const { rows, columns, spacing_m: spacing } = profile.manifest.grid;
  const data = new DataView(profile.buffer), frame = surfaceFrame(lat, lon);
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < rows * columns; i++) { const h = data.getFloat32(i * 4, true); low = Math.min(low, h); high = Math.max(high, h); }
  const relief = high - low;
  // Cells grow gradually away from the footprint: fine where the camera sits, coarse at
  // the horizon, and far enough out to cover the globe's own faceting.
  const axis = (count: number) => {
    const half = (count - 1) * spacing / 2, outer: number[] = [];
    for (let v = half, step = spacing; v < 900_000;) { step *= 1.05; v = Math.min(v + step, 900_000); outer.push(v); }
    return [...outer.slice().reverse().map(v => -v), ...Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * spacing), ...outer];
  };
  const xs = axis(columns), zs = axis(rows), positions = [], uv = [], colors = [], indices = [];
  const halfX = (columns - 1) * spacing / 2, halfZ = (rows - 1) * spacing / 2;
  const at = (c: number, r: number) => data.getFloat32((r * columns + c) * 4, true) - low;
  // The patch's overall tilt (least-squares plane), so a mountainside carries on as a slope
  // and then levels off, instead of stepping down to a plain at the patch's edge.
  let total = 0, slopeX = 0, slopeZ = 0, spanX = 0, spanZ = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const h = at(c, r), x = c * spacing - halfX, z = r * spacing - halfZ;
    total += h; slopeX += x * h; slopeZ += z * h; spanX += x * x; spanZ += z * z;
  }
  const mean = total / (rows * columns), tiltX = spanX ? slopeX / spanX : 0, tiltZ = spanZ ? slopeZ / spanZ : 0;
  const ease = (v: number) => 6000 * Math.tanh(v / 6000);
  const trend = (x: number, z: number) => mean + tiltX * ease(x) + tiltZ * ease(z);
  // How rough the land is, about that tilt, where it leaves the patch: the outer eighth of the grid.
  const band = Math.max(1, Math.round(Math.min(rows, columns) / 8)); let edgeSquares = 0, edgeCount = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    if (r >= band && r < rows - band && c >= band && c < columns - band) continue;
    const x = c * spacing - halfX, z = r * spacing - halfZ;
    edgeSquares += (at(c, r) - mean - tiltX * x - tiltZ * z) ** 2; edgeCount++;
  }
  const rough = Math.sqrt(edgeSquares / edgeCount);
  // Four octaves, hills down to hummocks, each offset so their grids do not line up.
  const hills = (x: number, z: number) => (noise(x / 2600 + 5.3, z / 2600 - 2.7) + .5 * noise(x / 1150 - 8.1, z / 1150 + 4.9) + .25 * noise(x / 480 + 1.7, z / 480 + 9.3) + .12 * noise(x / 210 - 3.3, z / 210 - 6.1)) / 1.2;
  const normal = new T.Vector3();
  for (let r = 0; r < zs.length; r++) for (let c = 0; c < xs.length; c++) {
    const x = xs[c], z = zs[r];
    const outside = Math.max(0, Math.abs(x) - halfX, Math.abs(z) - halfZ);
    let height: number;
    if (outside === 0) {
      height = at(Math.round(T.MathUtils.clamp((x + halfX) / spacing, 0, columns - 1)), Math.round(T.MathUtils.clamp((z + halfZ) / spacing, 0, rows - 1)));
    } else {
      // At the edge this is exactly the measured height; the generated ground grows in beyond it.
      // Ridges and gullies cut by the edge run on outwards, wandering and dying away at
      // uneven distances, so the patch's outline does not show as a straight-sided block.
      const wander = outside * .7, reach = 2200 * (1 + .5 * noise(x / 1700 + 6.6, z / 1700 - 1.4));
      const ex = T.MathUtils.clamp(x + wander * noise(x / 1900 + 11.3, z / 1900 - 4.1), -halfX, halfX);
      const ez = T.MathUtils.clamp(z + wander * noise(x / 1900 - 7.7, z / 1900 + 19.4), -halfZ, halfZ);
      const edge = at(Math.round((ex + halfX) / spacing), Math.round((ez + halfZ) / spacing));
      // Far out the cells are too coarse for hummocks: settle into broad rolling ground.
      const detail = rough * 1.6 * hills(x, z) * (1 - Math.exp(-outside / 600)) * Math.exp(-outside / 15_000);
      const rolling = rough * 1.2 * noise(x / 26_000 + 3.1, z / 26_000 + 8.2) * (1 - Math.exp(-outside / 8000));
      height = trend(x, z) + (edge - trend(ex, ez)) * Math.exp(-outside / reach) + detail + rolling;
    }
    // Subtle elevation tint makes relief legible without exaggerating it. It carries on past
    // the footprint, then fades so the cap meets the globe's own colour seen from orbit.
    const shade = 1 + (-.3 + .34 * T.MathUtils.clamp(height / (relief || 1), 0, 1)) * (1 - T.MathUtils.smoothstep(outside, 8_000, 60_000));
    colors.push(shade, shade, shade);
    const curve = Math.sqrt(EARTH_METRES ** 2 - x * x - z * z) - EARTH_METRES;
    positions.push(x, curve + height, z);
    normal.set(x, EARTH_METRES + curve, z).normalize().applyQuaternion(frame);
    let longitude = T.MathUtils.radToDeg(Math.atan2(-normal.z, normal.x));
    // Unwrap the seam so triangles near +/-180 degrees do not sample across Earth.
    longitude = lon + T.MathUtils.euclideanModulo(longitude - lon + 180, 360) - 180;
    uv.push((longitude + 180) / 360, .5 + Math.asin(normal.y) / Math.PI);
    const i = r * xs.length + c;
    if (r < zs.length - 1 && c < xs.length - 1) indices.push(i, i + xs.length, i + 1, i + 1, i + xs.length, i + xs.length + 1);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return { geometry, frame, relief };
}

export interface CameraPose { position: T.Vector3; target: T.Vector3; up: T.Vector3 }
const ease = (t: number) => { const c = T.MathUtils.clamp(t, 0, 1); return c * c * (3 - 2 * c); };

/** Orbit above the sphere before descending; a camera already high enough dives at once. Even opposite-side site changes cannot
 * take the camera through Earth. The initial and final poses are exact, including
 * when a player interrupts an approach or returns to orbit halfway through it.
 */
export function earthFlight(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  const start = from.position.clone().sub(EARTH_CENTRE), end = to.position.clone().sub(EARTH_CENTRE);
  const a = Math.max(start.length() - EARTH_RADIUS, .000001), b = Math.max(end.length() - EARTH_RADIUS, .000001);
  const angle = start.angleTo(end), cruise = Math.max(a, b, angle * EARTH_RADIUS * .65);
  // Time is spent climbing only when there is a climb to make.
  const climb = .28 * (1 - a / cruise);
  const turn = ease(progress / .6), descend = ease((progress - climb) / (1 - climb));
  const altitude = progress < climb
    ? T.MathUtils.lerp(a, cruise, ease(progress / climb))
    : Math.exp(T.MathUtils.lerp(Math.log(cruise), Math.log(b), descend));
  const rotation = new T.Quaternion().setFromUnitVectors(start.clone().normalize(), end.clone().normalize());
  const direction = start.normalize().applyQuaternion(new T.Quaternion().slerp(rotation, turn));
  return {
    position: direction.multiplyScalar(EARTH_RADIUS + altitude).add(EARTH_CENTRE),
    target: from.target.clone().lerp(to.target, ease(progress)),
    up: from.up.clone().applyQuaternion(new T.Quaternion().slerp(new T.Quaternion().setFromUnitVectors(from.up, to.up), ease(progress))).normalize(),
  };
}
