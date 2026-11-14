import {
  CallbackProperty, Cartesian2, Cartesian3, Color, Ellipsoid,
  EllipsoidalOccluder, Entity, LabelStyle,
} from 'cesium';

export type LunarSiteMarker = { id: string; name: string; lat: number; lon: number };

/** Catalog locators stay readable above the tiles, but never show through the Moon. */
export function createLunarSiteMarkers(
  sites: LunarSiteMarker[],
  getCameraPosition: () => Cartesian3,
  getSelected: () => string,
  ellipsoid: Ellipsoid = Ellipsoid.MOON,
): Entity[] {
  const occluder = new EllipsoidalOccluder(ellipsoid, getCameraPosition());
  return sites.map(site => {
    const surface = Cartesian3.fromDegrees(site.lon, site.lat, 0, ellipsoid);
    const visible = new CallbackProperty(() => {
      occluder.cameraPosition = getCameraPosition();
      return occluder.isPointVisible(surface);
    }, false);
    return new Entity({
      id: site.id,
      name: site.name,
      position: Cartesian3.fromDegrees(site.lon, site.lat, 5000, ellipsoid),
      point: {
        show: visible,
        pixelSize: new CallbackProperty(() => getSelected() === site.id ? 18 : 12, false),
        color: new CallbackProperty(() => getSelected() === site.id ? Color.GOLD : Color.WHITE, false),
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        // Fixed locator heights can lie under detailed relief. Draw the locator
        // above it; the lunar horizon callback separately rejects the far side.
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        show: new CallbackProperty(() => getSelected() === site.id && visible.getValue(), false),
        text: site.name,
        font: '14px sans-serif',
        fillColor: Color.GOLD,
        style: LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.BLACK.withAlpha(0.8),
        pixelOffset: new Cartesian2(0, -30),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  });
}
