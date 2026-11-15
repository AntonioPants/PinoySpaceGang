import * as T from 'three';
import type { TerrainProfile } from '../../lib/types';
import { landingArea, type LandingPoint } from '../../lib/landing';
import { EARTH_METRES } from './earthSurface';

/** Ground steeper than this is marked with red dots: the slope the standard landing gear is rated for, degrees. */
export const STEEP_SLOPE_DEG = 12;

/**
 * Choosing a landing point on the measured terrain: the selectable area's outline, a light
 * wash over it while the pointer is on it, a ring under the pointer, and a flag where the
 * player clicked. Everything is in the terrain patch's own frame (x east, y up, z south,
 * metres), so `group` is added to the patch. The simulation's frame is x east, y north:
 * a point here is the landing point { x, y: -z }.
 */
export function buildLandingPicker(profile: TerrainProfile) {
  const { rows, columns, spacing_m: spacing } = profile.manifest.grid, data = new DataView(profile.buffer);
  const halfX = (columns - 1) * spacing / 2, halfZ = (rows - 1) * spacing / 2, area = landingArea(profile);
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < rows * columns; i++) { const h = data.getFloat32(i * 4, true); low = Math.min(low, h); high = Math.max(high, h); }
  const at = (c: number, r: number) => data.getFloat32((r * columns + c) * 4, true) - low;
  /** Ground height in the patch's frame, including Earth's curvature, as the patch mesh draws it. */
  const heightAt = (x: number, z: number) => {
    const gc = T.MathUtils.clamp((x + halfX) / spacing, 0, columns - 1), gr = T.MathUtils.clamp((z + halfZ) / spacing, 0, rows - 1);
    const c0 = Math.min(Math.floor(gc), columns - 2), r0 = Math.min(Math.floor(gr), rows - 2), fc = gc - c0, fr = gr - r0;
    const ground = T.MathUtils.lerp(T.MathUtils.lerp(at(c0, r0), at(c0 + 1, r0), fc), T.MathUtils.lerp(at(c0, r0 + 1), at(c0 + 1, r0 + 1), fc), fr);
    return ground + Math.sqrt(EARTH_METRES ** 2 - x * x - z * z) - EARTH_METRES;
  };

  /** Where a ray (patch frame, unit direction) first meets the measured ground, or null if it misses the patch. */
  const pick = (origin: T.Vector3, direction: T.Vector3): T.Vector3 | null => {
    const step = spacing / 2, p = new T.Vector3();
    let before = 0, wasAbove = false;
    for (let t = 0; t < 40_000; t += step) {
      p.copy(origin).addScaledVector(direction, t);
      const over = Math.abs(p.x) <= halfX && Math.abs(p.z) <= halfZ;
      if (!over) { if (wasAbove) return null; continue; }   // left the patch without touching it
      if (p.y <= heightAt(p.x, p.z)) {
        if (!wasAbove) return null;                          // entered from below or through a side
        let a = before, b = t;
        for (let i = 0; i < 10; i++) { const m = (a + b) / 2; p.copy(origin).addScaledVector(direction, m); if (p.y > heightAt(p.x, p.z)) a = m; else b = m; }
        p.copy(origin).addScaledVector(direction, b); p.y = heightAt(p.x, p.z);
        return p;
      }
      wasAbove = true; before = t;
    }
    return null;
  };
  const inArea = (p: { x: number; z: number }) => Math.abs(p.x) <= area.halfX && Math.abs(p.z) <= area.halfY;

  const group = new T.Group();
  const gold = (opacity: number, depthTest = true) => new T.MeshBasicMaterial({ color: 0xf1d8a8, transparent: true, opacity, depthWrite: false, depthTest, side: T.DoubleSide });
  // The wash: the selectable ground itself, lifted a few metres, shown faintly on hover.
  const stride = Math.max(1, Math.round(60 / spacing)), xs: number[] = [], zs: number[] = [];
  for (let x = -area.halfX; x < area.halfX; x += spacing * stride) xs.push(x); xs.push(area.halfX);
  for (let z = -area.halfY; z < area.halfY; z += spacing * stride) zs.push(z); zs.push(area.halfY);
  const washPositions: number[] = [], washIndex: number[] = [];
  zs.forEach((z, r) => xs.forEach((x, c) => {
    washPositions.push(x, heightAt(x, z) + 3, z);
    if (r < zs.length - 1 && c < xs.length - 1) { const i = r * xs.length + c; washIndex.push(i, i + xs.length, i + 1, i + 1, i + xs.length, i + xs.length + 1); }
  }));
  const washGeometry = new T.BufferGeometry();
  washGeometry.setAttribute('position', new T.Float32BufferAttribute(washPositions, 3)); washGeometry.setIndex(washIndex);
  const wash = new T.Mesh(washGeometry, gold(0)); wash.renderOrder = 3; group.add(wash);
  // Its outline follows the ground and is always visible, so the player can see where a flag may go.
  const edge: number[] = [];
  const along = (x: number, z: number) => edge.push(x, heightAt(x, z) + 5, z);
  xs.forEach(x => along(x, -area.halfY)); zs.forEach(z => along(area.halfX, z));
  xs.slice().reverse().forEach(x => along(x, area.halfY)); zs.slice().reverse().forEach(z => along(-area.halfX, z));
  const edgeGeometry = new T.BufferGeometry(); edgeGeometry.setAttribute('position', new T.Float32BufferAttribute(edge, 3));
  const outline = new T.Line(edgeGeometry, new T.LineBasicMaterial({ color: 0xf1d8a8, transparent: true, opacity: 0, depthWrite: false }));
  outline.renderOrder = 4; group.add(outline);
  // The ring under the pointer.
  const cursor = new T.Mesh(new T.RingGeometry(.78, 1, 48).rotateX(-Math.PI / 2), gold(.95, false));
  cursor.visible = false; cursor.renderOrder = 6; group.add(cursor);
  // The flag: a pole, a pennant and a ring at its foot, one unit tall and scaled to stay readable.
  const flag = new T.Group();
  const pole = new T.Mesh(new T.CylinderGeometry(.018, .018, 1, 6).translate(0, .5, 0), new T.MeshBasicMaterial({ color: 0xf4efe4 }));
  const pennantGeometry = new T.BufferGeometry();
  pennantGeometry.setAttribute('position', new T.Float32BufferAttribute([0, 1, 0, 0, .66, 0, .46, .83, 0], 3));
  const pennant = new T.Mesh(pennantGeometry, new T.MeshBasicMaterial({ color: 0xe9c78a, side: T.DoubleSide }));
  const foot = new T.Mesh(new T.RingGeometry(.1, .14, 32).rotateX(-Math.PI / 2).translate(0, .01, 0), gold(.9, false));
  flag.add(pole, pennant, foot); flag.renderOrder = 5; group.add(flag);

  // Red dots on steep ground, one per measured cell whose slope is over the standard gear's
  // rating: where a touchdown is likely to go over. The slope is the measured grid's own
  // gradient (central differences), the same data the descent lands on.
  const steep: number[] = [];
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < columns - 1; c++) {
    const gradient = Math.hypot(at(c + 1, r) - at(c - 1, r), at(c, r + 1) - at(c, r - 1)) / (2 * spacing);
    if (Math.atan(gradient) * 180 / Math.PI < STEEP_SLOPE_DEG) continue;
    const x = c * spacing - halfX, z = r * spacing - halfZ;
    steep.push(x, heightAt(x, z) + 6, z);
  }
  const steepGeometry = new T.BufferGeometry(); steepGeometry.setAttribute('position', new T.Float32BufferAttribute(steep, 3));
  const steepMaterial = new T.PointsMaterial({ color: 0xff4d3d, size: 4.5, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const steepDots = new T.Points(steepGeometry, steepMaterial); steepDots.renderOrder = 4; steepDots.frustumCulled = false; group.add(steepDots);

  let hovering = false, shown = 0;
  return {
    group, pick, inArea, area,
    /** How many measured cells are steeper than STEEP_SLOPE_DEG. */
    steepCells: steep.length / 3,
    /** The pointer's ground point (inside the selectable area), or null when it is elsewhere. */
    setHover(point: T.Vector3 | null) { hovering = !!point; cursor.visible = !!point; if (point) cursor.position.copy(point).setY(point.y + 4); },
    setFlag(point: LandingPoint) { flag.position.set(point.x, heightAt(point.x, -point.y), -point.y); },
    /** Each frame: `eye` is the camera in the patch frame; `active` is true once the camera has settled on the terrain. */
    tick(eye: T.Vector3, active: boolean, dt: number) {
      shown += ((active ? 1 : 0) - shown) * (1 - Math.exp(-5 * dt));
      (wash.material as T.MeshBasicMaterial).opacity += ((hovering && active ? .13 : 0) - (wash.material as T.MeshBasicMaterial).opacity) * (1 - Math.exp(-9 * dt));
      (outline.material as T.LineBasicMaterial).opacity = .55 * shown;
      steepMaterial.opacity = .85 * shown; steepDots.visible = shown > .02;
      flag.visible = shown > .02; if (!active) cursor.visible = false;
      const reach = eye.distanceTo(flag.position);
      flag.scale.setScalar(T.MathUtils.clamp(reach * .05, 30, 2000) * shown);
      // turn the pennant's face to the viewer
      flag.rotation.y = Math.atan2(eye.x - flag.position.x, eye.z - flag.position.z);
      if (cursor.visible) cursor.scale.setScalar(Math.max(12, eye.distanceTo(cursor.position) * .016));
    },
  };
}
export type LandingPicker = ReturnType<typeof buildLandingPicker>;
