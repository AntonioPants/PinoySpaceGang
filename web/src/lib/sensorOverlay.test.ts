import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildOverlay, OVERLAY_STYLE, overlayStep, type OverlayStyle } from '../../../app/flightlab/sensorOverlay';
import { createSim, syntheticTerrain, HAZARD_SENSORS, HAZARD_SENSOR_IDS } from '../../../app/sim/src/index';
import type { HazardSensorId } from '../../../app/sim/src/index';

const rough = syntheticTerrain({ body: 'moon', hillsM: 140, sizeM: 2400, cellSize: 10, craters: 14 });
const place = (x: number, y: number, lift: number) => new THREE.Vector3(x, lift, -y);

/** The overlay a sensor draws, built from the sim's own classification of its view. */
function overlayFor(hazard: HazardSensorId, glare = 0.2) {
  const sim = createSim({ site: rough, strategy: 'autonomous', sensors: { hazard }, target: { x: 60, y: -40 }, interference: { glare } });
  const style = OVERLAY_STYLE[hazard], p = sim.sensor.profile, step = overlayStep(style, p.divertRadiusM, p.cellM);
  const cells = sim.hazardMap(sim.aim, p.divertRadiusM, step);
  return { cells, step, profile: p, overlay: buildOverlay(style, { cells, step, center: { ...sim.aim }, radiusM: p.divertRadiusM, quality: sim.sensor.quality, place }) };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const objects = <T extends THREE.Object3D>(root: THREE.Object3D, type: new (...a: any[]) => T): T[] => root.children.filter((o): o is T => o instanceof type);

describe('sensor overlays', () => {
  it('give every sensor a look, and nothing to sensors without a hazard map or to the crew window', () => {
    const styles = new Set<OverlayStyle>();
    for (const id of HAZARD_SENSOR_IDS) {
      styles.add(OVERLAY_STYLE[id]);
      if (!HAZARD_SENSORS[id].map || id === 'crew-window') expect(OVERLAY_STYLE[id], id).toBe('none');
    }
    expect([...styles].sort()).toEqual(['dots', 'drape', 'none', 'outline', 'raster']);
  });

  it("draw the sim's classification, cell for cell", () => {
    for (const id of ['lidar', 'flash-lidar', 'hazard-camera', 'terrain-nav'] as const) {
      const { cells, overlay } = overlayFor(id);
      expect(overlay.counts.safe + overlay.counts.slope + overlay.counts.rough, id).toBe(cells.length);
      expect(overlay.counts.safe, id).toBe(cells.filter(c => c.safe).length);
      expect(overlay.counts.slope + overlay.counts.rough, id).toBeGreaterThan(0);   // rough ground: some hazards
      overlay.dispose();
    }
  });

  it('lidar dots sweep outwards and make hazards stand out from safe ground', () => {
    const { overlay } = overlayFor('lidar');
    const [safe, slope] = objects(overlay.root, THREE.Points);
    expect((slope.material as THREE.PointsMaterial).size).toBeGreaterThan((safe.material as THREE.PointsMaterial).size);
    expect((slope.material as THREE.PointsMaterial).color.getHex()).not.toBe((safe.material as THREE.PointsMaterial).color.getHex());
    overlay.update(0.4); const early = safe.geometry.drawRange.count;
    overlay.update(2); const late = safe.geometry.drawRange.count;
    expect(early).toBeLessThan(late);
    expect(late).toBe(safe.geometry.attributes.position.count);
    overlay.dispose();
  });

  it('laser imager: crisp tiles over its short range only', () => {
    const imager = overlayFor('flash-lidar'), lidar = overlayFor('lidar');
    const reach = (o: typeof imager) => Math.max(...o.cells.map(c => Math.hypot(c.x - 60, c.y + 40)));
    expect(reach(imager)).toBeLessThanOrEqual(HAZARD_SENSORS['flash-lidar'].divertRadiusM);
    expect(reach(imager)).toBeLessThan(reach(lidar));
    const [tiles] = objects(imager.overlay.root, THREE.InstancedMesh);
    // one tile per cell, each sized to the grid in metres, laid down by the sweep
    const m = new THREE.Matrix4(), s = new THREE.Vector3();
    tiles.getMatrixAt(0, m); s.setFromMatrixScale(m);
    expect(s.x).toBeCloseTo(imager.step * 0.9, 6);
    imager.overlay.update(0); expect(tiles.count).toBeLessThan(imager.cells.length);
    imager.overlay.update(1); expect(tiles.count).toBe(imager.cells.length);
    imager.overlay.dispose(); lidar.overlay.dispose();
  });

  it('hazard camera: outlines only, fading as glare lowers detection quality', () => {
    const clear = overlayFor('hazard-camera', 0), glare = overlayFor('hazard-camera', 0.9);
    const lines = (o: typeof clear) => objects(o.overlay.root, THREE.LineSegments)[0];
    expect(objects(clear.overlay.root, THREE.Points)).toHaveLength(0);
    clear.overlay.update(5); glare.overlay.update(5);
    expect((lines(glare).material as THREE.Material).opacity).toBeLessThan((lines(clear).material as THREE.Material).opacity);
    expect(lines(clear).geometry.attributes.position.count).toBeGreaterThan(0);
    clear.overlay.dispose(); glare.overlay.dispose();
  });

  it('terrain navigation: a broad wash that covers its whole range and fades out at the edge', () => {
    const { overlay, profile } = overlayFor('terrain-nav');
    const [mesh] = objects(overlay.root, THREE.Mesh);
    const pos = mesh.geometry.attributes.position, col = mesh.geometry.attributes.color;
    expect(col.itemSize).toBe(4);
    let outside = 0, inside = 0;
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i) - 60, -pos.getZ(i) + 40);
      if (d > profile.divertRadiusM + 1) { expect(col.getW(i)).toBe(0); outside++; } else if (col.getW(i) > 0) inside++;
    }
    expect(outside).toBeGreaterThan(0); expect(inside).toBeGreaterThan(0);
    overlay.update(3); expect((mesh.material as THREE.Material).opacity).toBeGreaterThan(0.3);
    overlay.dispose();
  });
});
