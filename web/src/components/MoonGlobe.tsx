import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import Globe from './Globe';
import { projectSiteMarkers, type ScreenSiteMarker } from '../lib/planetarySiteMarkers';
import 'cesium/Build/Cesium/Widgets/widgets.css';

type Point = { id: string; name: string; lat: number; lon: number };
type Props = { body?: 'Moon' | 'Mars' | 'Earth'; points: Point[]; selected: string; onSelect: (id: string) => void; surface?: boolean };

export default function MoonGlobe({ points, selected, onSelect, body = 'Moon', surface = false }: Props) {
  const ellipsoid = body === 'Mars' ? Cesium.Ellipsoid.MARS : body === 'Earth' ? Cesium.Ellipsoid.WGS84 : Cesium.Ellipsoid.MOON;
  const cameraHeight = body === 'Earth' && surface ? 25_000 : ellipsoid.maximumRadius * 2.6;
  const host = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const selectedRef = useRef(selected);
  const selectRef = useRef(onSelect);
  selectedRef.current = selected; selectRef.current = onSelect;
  const [online, setOnline] = useState(navigator.onLine);
  const [failed, setFailed] = useState(false);
  const [markers, setMarkers] = useState<ScreenSiteMarker[]>([]);
  const [renderStatus, setRenderStatus] = useState('Connecting to Cesium…');
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
    let removeMarkerUpdates: (() => void) | undefined;
    let disposed = false;
    let firstTile = false;
    const timeout = window.setTimeout(() => { if (!disposed && !firstTile) { setRenderStatus('Cesium did not load within 30 seconds'); setFailed(true); } }, 30000);
    const start = async () => {
      try {
        viewer = new Cesium.Viewer(host.current!, { globe: false, skyAtmosphere: false, skyBox: false, baseLayer: false, baseLayerPicker: false, geocoder: false, animation: false, timeline: false, sceneModePicker: false, homeButton: false, navigationHelpButton: false, selectionIndicator: false, infoBox: false });
        viewerRef.current = viewer;
        viewer.scene.backgroundColor = Cesium.Color.BLACK; viewer.scene.fog.enabled = false; viewer.scene.light = new Cesium.SunLight();
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(body === 'Mars' ? 3644333 : body === 'Earth' ? 2275207 : 2684829, { enableCollision: true });
        if (disposed) { tileset.destroy(); return; }
        tileset.tileFailed.addEventListener(() => { if (!disposed) setRenderStatus('Some Cesium tiles failed to load'); });
        tileset.tileVisible.addEventListener(() => { if (!disposed && !firstTile) { firstTile = true; window.clearTimeout(timeout); setRenderStatus(body === 'Earth' ? 'Google Photorealistic 3D Tiles · visual context' : `Detailed Cesium ${body} · live terrain`); } });
        viewer.scene.primitives.add(tileset);
        const point = points.find(p => p.id === selectedRef.current) ?? points[0];
        if (point) viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, cameraHeight, ellipsoid) });
        const updateMarkers = () => {
          const next = projectSiteMarkers(points, viewer!.scene, ellipsoid);
          setMarkers(previous => previous.length === next.length && previous.every((marker, index) =>
            marker.id === next[index].id && Math.abs(marker.x - next[index].x) < 0.5 &&
            Math.abs(marker.y - next[index].y) < 0.5) ? previous : next);
        };
        removeMarkerUpdates = viewer.scene.postRender.addEventListener(updateMarkers);
        updateMarkers();
      } catch (error) { if (!disposed) { setRenderStatus(`Cesium unavailable: ${error instanceof Error ? error.message : 'connection or graphics error'}`); setFailed(true); } }
    };
    void start();
    return () => { disposed = true; window.clearTimeout(timeout); removeMarkerUpdates?.(); if (viewer && !viewer.isDestroyed()) viewer.destroy(); viewerRef.current = null; };
  }, [online, failed, points, body, ellipsoid]);
  useEffect(() => {
    const viewer = viewerRef.current, point = points.find(p => p.id === selected);
    if (!viewer || viewer.isDestroyed() || !point) return;
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, cameraHeight, ellipsoid), duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : body === 'Earth' && surface ? 4 : 1.2 });
  }, [selected, points, ellipsoid, cameraHeight, body, surface]);
  if (!online || failed) return <div className="moon-fallback"><Globe body={body} points={points} selected={selected} onSelect={onSelect} /><span className="moon-status" role="status">Using old offline {body} model · {!online ? 'No network connection' : renderStatus}<button onClick={() => { setOnline(navigator.onLine); setFailed(false); }}>Retry Cesium</button></span></div>;
  return <div className="globe-view"><div ref={host} className="globe-canvas" aria-label={`Cesium ${body}. Click a site dot to select it, or use the destination list. Drag to orbit.`} /><div className="cesium-site-layer">{markers.map(marker => <button key={marker.id} type="button" className="cesium-site-marker" aria-label={`Select ${marker.name}`} aria-pressed={selected === marker.id} title={marker.name} style={{ left: marker.x, top: marker.y }} onClick={() => selectRef.current(marker.id)}><span className="cesium-site-dot" />{selected === marker.id && <span className="cesium-site-name">{marker.name}</span>}</button>)}</div><span className="globe-disclaimer">{body === 'Earth' ? 'Google 3D imagery · Landing simulation uses the selected DEM' : `Cesium ${body}`} · Click a site dot to select · Approximate study-area locators</span><span className="moon-status" role="status">{renderStatus}</span></div>;
}
