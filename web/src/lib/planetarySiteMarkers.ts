import { Cartesian3, Ellipsoid, EllipsoidalOccluder, Scene, SceneTransforms } from 'cesium';

export type PlanetarySiteMarker = { id: string; name: string; lat: number; lon: number };
export type ScreenSiteMarker = PlanetarySiteMarker & { x: number; y: number };

/** Project catalog locations onto the canvas, excluding the far side of the body. */
export function projectSiteMarkers(
  sites: PlanetarySiteMarker[], scene: Scene, ellipsoid: Ellipsoid,
): ScreenSiteMarker[] {
  const occluder = new EllipsoidalOccluder(ellipsoid, scene.camera.positionWC);
  const { clientWidth, clientHeight } = scene.canvas;
  return sites.flatMap(site => {
    const surface = Cartesian3.fromDegrees(site.lon, site.lat, 0, ellipsoid);
    if (!occluder.isPointVisible(surface)) return [];
    const raised = Cartesian3.fromDegrees(site.lon, site.lat, 5000, ellipsoid);
    const screen = SceneTransforms.worldToWindowCoordinates(scene, raised);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y) ||
      screen.x < 0 || screen.y < 0 || screen.x > clientWidth || screen.y > clientHeight) return [];
    return [{ ...site, x: screen.x, y: screen.y }];
  });
}
