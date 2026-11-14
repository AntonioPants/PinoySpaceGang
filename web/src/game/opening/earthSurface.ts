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

/** Real DEM inside its footprint; curved, unmeasured Earth context beyond it.
 * Shared equirectangular imagery keeps the local cap registered with the globe.
 * This display geometry is never passed to the physics engine.
 */
export function earthSurface(profile: TerrainProfile, lat: number, lon: number) {
  const { rows, columns, spacing_m: spacing } = profile.manifest.grid;
  const data = new DataView(profile.buffer), frame = surfaceFrame(lat, lon);
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < rows * columns; i++) { const h = data.getFloat32(i * 4, true); low = Math.min(low, h); high = Math.max(high, h); }
  // Extra rings provide a curved horizon instead of a floating square's edge.
  const axis = (count: number) => {
    const half = (count - 1) * spacing / 2;
    const outer = [6_000, 15_000, 40_000, 100_000, 250_000, 500_000, 900_000].filter(v => v > half);
    return [...outer.slice().reverse().map(v => -v), ...Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * spacing), ...outer];
  };
  const xs = axis(columns), zs = axis(rows), positions = [], uv = [], colors = [], indices = [];
  const halfX = (columns - 1) * spacing / 2, halfZ = (rows - 1) * spacing / 2;
  for (let r = 0; r < zs.length; r++) for (let c = 0; c < xs.length; c++) {
    const x = xs[c], z = zs[r];
    const dc = Math.round(T.MathUtils.clamp((x + halfX) / spacing, 0, columns - 1));
    const dr = Math.round(T.MathUtils.clamp((z + halfZ) / spacing, 0, rows - 1));
    const outside = Math.max(0, Math.abs(x) - halfX, Math.abs(z) - halfZ);
    const height = (data.getFloat32((dr * columns + dc) * 4, true) - low) * Math.exp(-outside / 6000);
    // Subtle elevation tint makes measured relief legible without exaggerating it.
    const shade = 1 + (-.3 + .34 * height / (high - low || 1)) * Math.exp(-outside / 1500);
    colors.push(shade, shade, shade);
    const curve = Math.sqrt(EARTH_METRES ** 2 - x * x - z * z) - EARTH_METRES;
    positions.push(x, curve + height, z);
    const normal = new T.Vector3(x, EARTH_METRES + curve, z).normalize().applyQuaternion(frame);
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
  return { geometry, frame, relief: high - low };
}

export interface CameraPose { position: T.Vector3; target: T.Vector3; up: T.Vector3 }
const ease = (t: number) => { const c = T.MathUtils.clamp(t, 0, 1); return c * c * (3 - 2 * c); };

/** Orbit above the sphere before descending. Even opposite-side site changes cannot
 * take the camera through Earth. The initial and final poses are exact, including
 * when a player interrupts an approach or returns to orbit halfway through it.
 */
export function earthFlight(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  const start = from.position.clone().sub(EARTH_CENTRE), end = to.position.clone().sub(EARTH_CENTRE);
  const a = Math.max(start.length() - EARTH_RADIUS, .000001), b = Math.max(end.length() - EARTH_RADIUS, .000001);
  const angle = start.angleTo(end), cruise = Math.max(a, b, angle * EARTH_RADIUS * .65);
  const turn = ease(progress / .6), descend = ease((progress - .28) / .72);
  const altitude = progress < .28
    ? T.MathUtils.lerp(a, cruise, ease(progress / .28))
    : Math.exp(T.MathUtils.lerp(Math.log(cruise), Math.log(b), descend));
  const rotation = new T.Quaternion().setFromUnitVectors(start.clone().normalize(), end.clone().normalize());
  const direction = start.normalize().applyQuaternion(new T.Quaternion().slerp(rotation, turn));
  return {
    position: direction.multiplyScalar(EARTH_RADIUS + altitude).add(EARTH_CENTRE),
    target: from.target.clone().lerp(to.target, ease(progress)),
    up: from.up.clone().applyQuaternion(new T.Quaternion().slerp(new T.Quaternion().setFromUnitVectors(from.up, to.up), ease(progress))).normalize(),
  };
}
