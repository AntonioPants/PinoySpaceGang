import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cartesian2, Cartesian3, Ellipsoid, Scene, SceneTransforms } from 'cesium';
import { projectSiteMarkers } from './planetarySiteMarkers';

afterEach(() => vi.restoreAllMocks());

describe('Cesium site locator projection', () => {
  it('shows near-side catalog sites and hides the far side', () => {
    vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockReturnValue(new Cartesian2(300, 200));
    const scene = {
      camera: { positionWC: Cartesian3.fromDegrees(0, 0, 4500000, Ellipsoid.MOON) },
      canvas: { clientWidth: 600, clientHeight: 400 },
    } as Scene;
    expect(projectSiteMarkers([
      { id: 'near', name: 'Near', lat: 0, lon: 0 },
      { id: 'far', name: 'Far', lat: 0, lon: 180 },
    ], scene, Ellipsoid.MOON)).toEqual([{ id: 'near', name: 'Near', lat: 0, lon: 0, x: 300, y: 200 }]);
  });

  it('projects Mars sites using its ellipsoid and excludes points outside the canvas', () => {
    const projection = vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockReturnValue(new Cartesian2(700, 200));
    const scene = {
      camera: { positionWC: Cartesian3.fromDegrees(0, 0, 8000000, Ellipsoid.MARS) },
      canvas: { clientWidth: 600, clientHeight: 400 },
    } as Scene;
    const sites = [{ id: 'mars', name: 'Mars site', lat: 0, lon: 0 }];
    expect(projectSiteMarkers(sites, scene, Ellipsoid.MARS)).toEqual([]);
    projection.mockReturnValue(new Cartesian2(300, 200));
    expect(projectSiteMarkers(sites, scene, Ellipsoid.MARS)[0].id).toBe('mars');
    expect(projection.mock.lastCall![1].x).toBeCloseTo(Ellipsoid.MARS.maximumRadius + 5000);
  });

  it('keeps Earth catalog locators on the Google tiles as the camera moves', () => {
    vi.spyOn(SceneTransforms, 'worldToWindowCoordinates').mockReturnValue(new Cartesian2(300, 200));
    let cameraPosition = Cartesian3.fromDegrees(-106, 32, 17_000_000, Ellipsoid.WGS84);
    const scene = {
      camera: { get positionWC() { return cameraPosition; } },
      canvas: { clientWidth: 600, clientHeight: 400 },
    } as Scene;
    const sites = [
      { id: 'new-mexico', name: 'New Mexico', lat: 32, lon: -106 },
      { id: 'australia', name: 'Australia', lat: -22, lon: 126 },
    ];
    expect(projectSiteMarkers(sites, scene, Ellipsoid.WGS84).map(site => site.id)).toEqual(['new-mexico']);
    cameraPosition = Cartesian3.fromDegrees(126, -22, 17_000_000, Ellipsoid.WGS84);
    expect(projectSiteMarkers(sites, scene, Ellipsoid.WGS84).map(site => site.id)).toEqual(['australia']);
  });
});
