import { describe, expect, it } from 'vitest';
import { Cartesian3, Color, Ellipsoid, JulianDate } from 'cesium';
import { createLunarSiteMarkers } from './lunarSiteMarkers';

describe('lunar site locators', () => {
  it('shows near-side dots above relief and hides far-side dots, including after orbiting', () => {
    let camera = Cartesian3.fromDegrees(0, 0, 4500000, Ellipsoid.MOON);
    const markers = createLunarSiteMarkers([
      { id: 'near', name: 'Near', lat: 0, lon: 0 },
      { id: 'far', name: 'Far', lat: 0, lon: 180 },
    ], () => camera, () => 'near');
    const time = JulianDate.now();
    expect(markers[0].point!.show!.getValue(time)).toBe(true);
    expect(markers[0].point!.disableDepthTestDistance!.getValue(time)).toBe(Infinity);
    expect(markers[1].point!.show!.getValue(time)).toBe(false);
    expect(markers[1].label!.show!.getValue(time)).toBe(false);
    camera = Cartesian3.fromDegrees(180, 0, 4500000, Ellipsoid.MOON);
    expect(markers[0].point!.show!.getValue(time)).toBe(false);
    expect(markers[1].point!.show!.getValue(time)).toBe(true);
  });

  it('tracks selection before or after async tileset loading without losing catalog identity', () => {
    let selected = 'a';
    const [a, b] = createLunarSiteMarkers([
      { id: 'a', name: 'Site A', lat: 0, lon: 0 },
      { id: 'b', name: 'Site B', lat: 1, lon: 1 },
    ], () => Cartesian3.fromDegrees(0, 0, 4500000, Ellipsoid.MOON), () => selected);
    const time = JulianDate.now();
    expect(a.id).toBe('a');
    expect(a.point!.color!.getValue(time)).toEqual(Color.GOLD);
    expect(a.label!.show!.getValue(time)).toBe(true);
    selected = 'b';
    expect(a.point!.color!.getValue(time)).toEqual(Color.WHITE);
    expect(a.label!.show!.getValue(time)).toBe(false);
    expect(b.label!.show!.getValue(time)).toBe(true);
    expect(b.point!.pixelSize!.getValue(time)).toBeGreaterThan(a.point!.pixelSize!.getValue(time));
  });
});
