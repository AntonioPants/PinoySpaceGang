import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import Globe from './Globe';
import 'cesium/Build/Cesium/Widgets/widgets.css';

type Point = { id: string; name: string; lat: number; lon: number };
type Props = { points: Point[]; selected: string; onSelect: (id: string) => void };

export default function MoonGlobe({ points, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const selectedRef = useRef(selected);
  const selectRef = useRef(onSelect);
  selectedRef.current = selected; selectRef.current = onSelect;
  const [online, setOnline] = useState(navigator.onLine);
  const [failed, setFailed] = useState(false);
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
    Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;
    Cesium.Ion.defaultAccessToken = token;
    let viewer: Cesium.Viewer | undefined;
    let handler: Cesium.ScreenSpaceEventHandler | undefined;
    let disposed = false;
    const start = async () => {
      try {
        viewer = new Cesium.Viewer(host.current!, { globe: false, skyAtmosphere: false, skyBox: false, baseLayer: false, baseLayerPicker: false, geocoder: false, animation: false, timeline: false, sceneModePicker: false, homeButton: false, navigationHelpButton: false, selectionIndicator: false, infoBox: false });
        viewerRef.current = viewer;
        viewer.scene.backgroundColor = Cesium.Color.BLACK; viewer.scene.fog.enabled = false; viewer.scene.light = new Cesium.SunLight();
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(2684829, { enableCollision: true });
        if (disposed) { tileset.destroy(); return; }
        tileset.tileFailed.addEventListener(() => { if (!disposed) setRenderStatus('Some Cesium tiles failed to load'); });
        tileset.initialTilesLoaded.addEventListener(() => { if (!disposed) setRenderStatus('Cesium Moon loaded'); });
        viewer.scene.primitives.add(tileset);
        for (const point of points) viewer.entities.add({ id: point.id, name: point.name, position: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 5000, Cesium.Ellipsoid.MOON), point: { pixelSize: 10, color: Cesium.Color.GOLD, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: 0 } });
        const point = points.find(p => p.id === selectedRef.current) ?? points[0];
        if (point) viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 4500000, Cesium.Ellipsoid.MOON) });
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((event: { position: Cesium.Cartesian2 }) => {
          const hit = viewer?.scene.pick(event.position);
          if (hit?.id instanceof Cesium.Entity && points.some(p => p.id === hit.id.id)) selectRef.current(hit.id.id);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      } catch (error) { if (!disposed) { setRenderStatus(`Cesium unavailable: ${error instanceof Error ? error.message : 'connection or graphics error'}`); setFailed(true); } }
    };
    void start();
    return () => { disposed = true; handler?.destroy(); if (viewer && !viewer.isDestroyed()) viewer.destroy(); viewerRef.current = null; };
  }, [online, failed, points]);
  useEffect(() => {
    const viewer = viewerRef.current, point = points.find(p => p.id === selected);
    if (!viewer || viewer.isDestroyed() || !point) return;
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 4500000, Cesium.Ellipsoid.MOON), duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1.2 });
    for (const entity of viewer.entities.values) if (entity.point) entity.point.color = new Cesium.ConstantProperty(entity.id === selected ? Cesium.Color.GOLD : Cesium.Color.WHITE);
  }, [selected, points]);
  if (!online || failed) return <div className="moon-fallback"><Globe body="Moon" points={points} selected={selected} onSelect={onSelect} /><span className="moon-status" role="status">{!online ? 'Offline · reference Moon' : `${renderStatus} · reference Moon`}</span></div>;
  return <div className="globe-view"><div ref={host} className="globe-canvas" aria-label="Cesium Moon. Drag to orbit; use the destination list to select a site." /><span className="globe-disclaimer">Cesium Moon · approximate site locators</span><span className="moon-status" role="status">{renderStatus}</span></div>;
}
