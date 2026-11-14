import { Cartographic, Ellipsoid, Math as CesiumMath, type Cartesian2, type Viewer } from 'cesium';

/** Heights are dataset samples relative to the 1,737,400 m lunar sphere. */
export function createLunarTopology(viewer: Viewer) {
  return {
    async getLunarElevation(latDeg: number, lonDeg: number): Promise<number> {
      if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg) || Math.abs(latDeg) > 90 || Math.abs(lonDeg) > 180) throw new Error('Invalid latitude or longitude.');
      if (viewer.isDestroyed() || !viewer.scene.sampleHeightSupported) throw new Error('Height sampling is unavailable.');
      const [point] = await viewer.scene.sampleHeightMostDetailed([Cartographic.fromDegrees(lonDeg, latDeg)]);
      if (!point || !Number.isFinite(point.height)) throw new Error('No lunar elevation is available here.');
      return point.height;
    },
    getSurfacePointFromClick(screenPosition: Cartesian2) {
      if (viewer.isDestroyed() || !viewer.scene.pickPositionSupported) return null;
      const hit = viewer.scene.pickPosition(screenPosition);
      if (!hit) return null;
      const point = Cartographic.fromCartesian(hit, Ellipsoid.MOON);
      if (!point) return null;
      return { lat: CesiumMath.toDegrees(point.latitude), lon: CesiumMath.toDegrees(point.longitude), elevationMeters: point.height };
    },
  };
}
