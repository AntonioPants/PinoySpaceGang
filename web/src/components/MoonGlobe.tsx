import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as Cesium from 'cesium';
import Globe from './Globe';
import { projectSiteMarkers, type ScreenSiteMarker } from '../lib/planetarySiteMarkers';
import 'cesium/Build/Cesium/Widgets/widgets.css';

type Point = { id: string; name: string; lat: number; lon: number };
/** A camera that looks at the world's centre, north up: where it is over the surface and how far out, in world radii. */
export interface OrbitView { lat: number; lon: number; radii: number }
/** A camera near a site, in the site's east-north-up frame (metres): where it is and the point it looks at. */
export interface SurfaceView { position: [number, number, number]; target: [number, number, number] }
/** Lets the game hand a camera between this Cesium view and its own Three.js scene, so swapping them does not move the picture. */
export interface GlobeHandle {
  orbit(): OrbitView | null; setOrbit(view: OrbitView): void;
  surface(site: { lat: number; lon: number }, height: number): SurfaceView | null;
  setSurface(site: { lat: number; lon: number }, height: number, view: SurfaceView): void;
}
type Props = {
  body?: 'Moon' | 'Mars' | 'Earth'; points: Point[]; selected: string; onSelect: (id: string) => void; surface?: boolean;
  /** The game's layered mode: no offline model here (the game's own globe sits underneath), cameras matched to it. */
  layered?: boolean;
  /** Layered mode: how far out the orbit camera sits, in world radii, on a landscape screen. */
  orbitRadii?: number;
  /** True once the first tile is on screen; false again on failure or when the viewer is torn down. */
  onReady?: (ready: boolean) => void;
  handle?: MutableRefObject<GlobeHandle | null>;
  /** Stops Cesium's render loop while the view is hidden. */
  paused?: boolean;
  /** A click on bare surface (not a drag, not a site dot): planetocentric latitude and east longitude, degrees. */
  onSurfacePick?: (point: { lat: number; lon: number }) => void;
  /** A pinned point to draw. */
  pin?: { lat: number; lon: number } | null;
  /** The site under the pointer here or in a list beside the globe; its dot swells and is named. */
  hovered?: string | null;
  onHover?: (id: string | null) => void;
};
/** The game's Three.js camera: 42 degrees vertical. Cesium is matched to it in layered mode. */
const GAME_FOV = Cesium.Math.toRadians(42);
const PIN_ID = '__pin';

function siteCamera(point: Point, ellipsoid: Cesium.Ellipsoid, surface: boolean) {
  const center = Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 0, ellipsoid);
  const offset = surface
    ? new Cesium.Cartesian3(0, -7000, 8500)
    : new Cesium.Cartesian3(0, 0, ellipsoid.maximumRadius * 2.6);
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(center, ellipsoid);
  return {
    destination: Cesium.Matrix4.multiplyByPoint(frame, offset, new Cesium.Cartesian3()),
    orientation: { heading: 0, pitch: surface ? -Math.atan2(offset.z, -offset.y) : -Math.PI / 2, roll: 0 },
  };
}

/** A camera at `view`, looking at the world's centre with north up. Latitude is measured from the centre. */
function orbitCamera(view: OrbitView, ellipsoid: Cesium.Ellipsoid) {
  const lat = Cesium.Math.toRadians(Cesium.Math.clamp(view.lat, -89, 89)), lon = Cesium.Math.toRadians(view.lon), r = view.radii * ellipsoid.maximumRadius;
  const destination = new Cesium.Cartesian3(r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat));
  const direction = Cesium.Cartesian3.normalize(Cesium.Cartesian3.negate(destination, new Cesium.Cartesian3()), new Cesium.Cartesian3());
  const up = new Cesium.Cartesian3(-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat));
  return { destination, orientation: { direction, up } };
}
/** The game's globe frames a site from latitude x 0.8, further out on a portrait screen. */
const siteOrbit = (point: Point, radii: number, aspect: number): OrbitView => ({ lat: point.lat * .8, lon: point.lon, radii: radii * Math.max(1, .85 / aspect) });

export default function MoonGlobe({ points, selected, onSelect, body = 'Moon', surface = false, layered = false, orbitRadii, onReady, handle, paused = false, onSurfacePick, pin, hovered = null, onHover }: Props) {
  const ellipsoid = body === 'Mars' ? Cesium.Ellipsoid.MARS : body === 'Earth' ? Cesium.Ellipsoid.WGS84 : Cesium.Ellipsoid.MOON;
  const host = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const selectedRef = useRef(selected);
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const selectRef = useRef(onSelect);
  selectedRef.current = selected; selectRef.current = onSelect;
  // Read through refs, so a new list of sites or a new pin never rebuilds the viewer.
  const pointsRef = useRef(points), pinRef = useRef(pin), readyRef = useRef(onReady), pickRef = useRef(onSurfacePick), pausedRef = useRef(paused);
  pointsRef.current = points; pinRef.current = pin; readyRef.current = onReady; pickRef.current = onSurfacePick; pausedRef.current = paused;
  const [online, setOnline] = useState(navigator.onLine);
  const [failed, setFailed] = useState(false);
  const [markers, setMarkers] = useState<ScreenSiteMarker[]>([]);
  const [renderStatus, setRenderStatus] = useState('Connecting to Cesium…');
  const aspect = () => { const canvas = viewerRef.current?.scene.canvas; return canvas && canvas.clientHeight ? canvas.clientWidth / canvas.clientHeight : 1.6; };
  const view = (point: Point, onSurface: boolean) => !onSurface && orbitRadii ? orbitCamera(siteOrbit(point, orbitRadii, aspect()), ellipsoid) : siteCamera(point, ellipsoid, onSurface);
  useEffect(() => {
    const onOnline = () => { setFailed(false); setOnline(true); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);
  useEffect(() => {
    if (!online || !failed) return;
    const retry = window.setTimeout(() => setFailed(false), 30000);
    return () => window.clearTimeout(retry);
  }, [online, failed]);
  useEffect(() => {
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
    if (!online || failed || !host.current) return;
    if (!token || token === 'YOUR_CESIUM_ION_TOKEN') { setRenderStatus('Cesium token missing'); setFailed(true); return; }
    setRenderStatus('Connecting to Cesium…');
    Cesium.Ellipsoid.default = ellipsoid;
    Cesium.Ion.defaultAccessToken = token;
    let viewer: Cesium.Viewer | undefined;
    let removeMarkerUpdates: (() => void) | undefined, removeFov: (() => void) | undefined, clicks: Cesium.ScreenSpaceEventHandler | undefined;
    let disposed = false;
    let firstTile = false;
    const timeout = window.setTimeout(() => { if (!disposed && !firstTile) { setRenderStatus('Cesium did not load within 30 seconds'); setFailed(true); } }, 30000);
    const start = async () => {
      try {
        viewer = new Cesium.Viewer(host.current!, { globe: false, skyAtmosphere: false, skyBox: false, baseLayer: false, baseLayerPicker: false, geocoder: false, animation: false, timeline: false, sceneModePicker: false, homeButton: false, navigationHelpButton: false, selectionIndicator: false, infoBox: false });
        viewerRef.current = viewer;
        viewer.useDefaultRenderLoop = !pausedRef.current;
        viewer.scene.backgroundColor = Cesium.Color.BLACK; viewer.scene.fog.enabled = false; viewer.scene.light = new Cesium.SunLight();
        if (layered) {
          // Same vertical field of view as the game's own globe, whatever the window's shape.
          const scene = viewer.scene;
          removeFov = scene.preRender.addEventListener(() => {
            const frustum = scene.camera.frustum, a = scene.canvas.clientWidth / Math.max(scene.canvas.clientHeight, 1);
            if (frustum instanceof Cesium.PerspectiveFrustum) frustum.fov = a >= 1 ? 2 * Math.atan(a * Math.tan(GAME_FOV / 2)) : GAME_FOV;
          });
        }
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(body === 'Mars' ? 3644333 : body === 'Earth' ? 2275207 : 2684829, { enableCollision: true });
        if (disposed) { tileset.destroy(); return; }
        tileset.tileFailed.addEventListener(() => { if (!disposed) setRenderStatus('Some Cesium tiles failed to load'); });
        tileset.tileVisible.addEventListener(() => { if (!disposed && !firstTile) { firstTile = true; window.clearTimeout(timeout); setRenderStatus(body === 'Earth' ? 'Google Photorealistic 3D Tiles · visual context' : `Detailed Cesium ${body} · live terrain`); readyRef.current?.(true); } });
        viewer.scene.primitives.add(tileset);
        const point = pointsRef.current.find(p => p.id === selectedRef.current) ?? pointsRef.current[0];
        if (point) viewer.camera.setView(view(point, surfaceRef.current));
        const updateMarkers = () => {
          const pinned = pinRef.current, all = pinned ? [...pointsRef.current, { id: PIN_ID, name: 'Your pin', lat: pinned.lat, lon: pinned.lon }] : pointsRef.current;
          const next = projectSiteMarkers(all, viewer!.scene, ellipsoid, body === 'Earth' ? tileset : undefined);
          setMarkers(previous => previous.length === next.length && previous.every((marker, index) =>
            marker.id === next[index].id && Math.abs(marker.x - next[index].x) < 0.5 &&
            Math.abs(marker.y - next[index].y) < 0.5) ? previous : next);
        };
        removeMarkerUpdates = viewer.scene.postRender.addEventListener(updateMarkers);
        updateMarkers();
        // A click on bare ground. Cesium's LEFT_CLICK does not fire for drags; site dots are buttons above the canvas.
        clicks = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clicks.setInputAction((event: { position: Cesium.Cartesian2 }) => {
          if (!pickRef.current || !viewer || viewer.isDestroyed()) return;
          const scene = viewer.scene;
          let hit = scene.pickPositionSupported ? scene.pickPosition(event.position) : undefined;
          if (!hit || !Number.isFinite(hit.x) || Cesium.Cartesian3.magnitude(hit) < ellipsoid.minimumRadius * .9) {
            const ray = scene.camera.getPickRay(event.position), span = ray && Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);
            hit = ray && span ? Cesium.Ray.getPoint(ray, span.start) : undefined;
          }
          if (!hit) return;
          // Measured from the centre, as the global elevation mosaics are.
          const r = Cesium.Cartesian3.magnitude(hit);
          pickRef.current({ lat: Cesium.Math.toDegrees(Math.asin(hit.z / r)), lon: Cesium.Math.toDegrees(Math.atan2(hit.y, hit.x)) });
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      } catch (error) { if (!disposed) { setRenderStatus(`Cesium unavailable: ${error instanceof Error ? error.message : 'connection or graphics error'}`); setFailed(true); } }
    };
    void start();
    return () => { disposed = true; window.clearTimeout(timeout); removeMarkerUpdates?.(); removeFov?.(); clicks?.destroy(); if (viewer && !viewer.isDestroyed()) viewer.destroy(); viewerRef.current = null; readyRef.current?.(false); };
  }, [online, failed, body, ellipsoid, layered]);
  useEffect(() => { if (failed || !online) readyRef.current?.(false); }, [failed, online]);
  useEffect(() => {
    const viewer = viewerRef.current, point = points.find(p => p.id === selected);
    if (!viewer || viewer.isDestroyed() || !point) return;
    viewer.camera.flyTo({ ...view(point, surface), duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : body === 'Earth' && surface ? 4 : 1.2 });
    // The list of sites may change without the selection moving: that must not restart a flight.
  }, [selected, ellipsoid, body, surface]);
  useEffect(() => { const viewer = viewerRef.current; if (viewer && !viewer.isDestroyed()) viewer.useDefaultRenderLoop = !paused; }, [paused]);
  useEffect(() => { const viewer = viewerRef.current; if (viewer && !viewer.isDestroyed()) viewer.scene.requestRender(); }, [pin, points]);
  useEffect(() => {
    if (!handle) return;
    const live = () => { const viewer = viewerRef.current; return viewer && !viewer.isDestroyed() ? viewer : null; };
    const frameAt = (site: { lat: number; lon: number }, height: number) => Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(site.lon, site.lat, height, ellipsoid), ellipsoid);
    handle.current = {
      orbit() {
        const viewer = live(); if (!viewer) return null;
        const p = viewer.camera.positionWC, r = Cesium.Cartesian3.magnitude(p);
        return { lat: Cesium.Math.toDegrees(Math.asin(p.z / r)), lon: Cesium.Math.toDegrees(Math.atan2(p.y, p.x)), radii: r / ellipsoid.maximumRadius };
      },
      setOrbit(next) { const viewer = live(); if (!viewer) return; viewer.camera.cancelFlight(); viewer.camera.setView(orbitCamera(next, ellipsoid)); },
      surface(site, height) {
        const viewer = live(); if (!viewer) return null;
        const inverse = Cesium.Matrix4.inverseTransformation(frameAt(site, height), new Cesium.Matrix4());
        const p = Cesium.Matrix4.multiplyByPoint(inverse, viewer.camera.positionWC, new Cesium.Cartesian3());
        const d = Cesium.Matrix4.multiplyByPointAsVector(inverse, viewer.camera.directionWC, new Cesium.Cartesian3());
        // Look at where the view meets the site's level; a view that never meets it nearby looks as far ahead as the site is away.
        const down = d.z < -1e-3 ? -p.z / d.z : Infinity, reach = Math.hypot(p.x, p.y, p.z);
        const t = down > 100 && down < Math.max(4 * reach, 20000) ? down : Math.max(reach, 1000);
        return { position: [p.x, p.y, p.z], target: [p.x + d.x * t, p.y + d.y * t, p.z + d.z * t] };
      },
      setSurface(site, height, next) {
        const viewer = live(); if (!viewer) return;
        const frame = frameAt(site, height);
        const destination = Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(...next.position), new Cesium.Cartesian3());
        const target = Cesium.Matrix4.multiplyByPoint(frame, new Cesium.Cartesian3(...next.target), new Cesium.Cartesian3());
        const direction = Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(target, destination, new Cesium.Cartesian3()), new Cesium.Cartesian3());
        const zenith = Cesium.Matrix4.multiplyByPointAsVector(frame, Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3());
        const right = Cesium.Cartesian3.cross(direction, zenith, new Cesium.Cartesian3());
        if (Cesium.Cartesian3.magnitude(right) < 1e-6) return;
        const up = Cesium.Cartesian3.normalize(Cesium.Cartesian3.cross(right, direction, new Cesium.Cartesian3()), new Cesium.Cartesian3());
        viewer.camera.cancelFlight(); viewer.camera.setView({ destination, orientation: { direction, up } });
      },
    };
    return () => { handle.current = null; };
  }, [handle, ellipsoid]);
  if (!online || failed) return layered ? null : <div className="moon-fallback"><Globe body={body} points={points} selected={selected} onSelect={onSelect} /><span className="moon-status" role="status">Using old offline {body} model · {!online ? 'No network connection' : renderStatus}<button onClick={() => { setOnline(navigator.onLine); setFailed(false); }}>Retry Cesium</button></span></div>;
  return <div className="globe-view"><div ref={host} className="globe-canvas" aria-label={`Cesium ${body}. Click a site dot to select it, or use the destination list. Drag to orbit.`} /><div className="cesium-site-layer">{markers.map(marker => marker.id === PIN_ID
    ? <span key={marker.id} className="cesium-pin" style={{ left: marker.x, top: marker.y }} aria-hidden="true" />
    : <button key={marker.id} type="button" className={`cesium-site-marker${hovered === marker.id ? ' is-hovered' : ''}`} aria-label={`Select ${marker.name}`} aria-pressed={selected === marker.id} title={marker.name} style={{ left: marker.x, top: marker.y }} onClick={() => selectRef.current(marker.id)}
        onPointerEnter={() => onHover?.(marker.id)} onPointerLeave={() => onHover?.(null)} onFocus={() => onHover?.(marker.id)} onBlur={() => onHover?.(null)}><span className="cesium-site-dot" />{(selected === marker.id || hovered === marker.id) && <span className="cesium-site-name">{marker.name}</span>}</button>)}</div><span className="globe-disclaimer">{body === 'Earth' ? 'Google 3D imagery · Landing simulation uses the selected DEM' : `Cesium ${body}`} · Click a site dot to select{onSurfacePick ? ' · Click the surface to drop a pin' : ''} · Approximate study-area locators</span><span className="moon-status" role="status">{renderStatus}</span></div>;
}
