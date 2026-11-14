import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { createLunarTopology } from '../lib/lunarTopology';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export default function MoonExplorer() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading lunar surface…');
  useEffect(() => {
    const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
    if (!token || token === 'YOUR_CESIUM_ION_TOKEN') { setStatus('Set VITE_CESIUM_ION_TOKEN in web/.env and restart the dev server.'); return; }
    Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;
    Cesium.Ion.defaultAccessToken = token;
    let viewer: Cesium.Viewer | undefined;
    let disposed = false;
    let sequence = 0;
    let handler: Cesium.ScreenSpaceEventHandler | undefined;
    async function start() {
      try {
        viewer = new Cesium.Viewer(container.current!, { globe: false, skyAtmosphere: false, skyBox: false, baseLayerPicker: false, baseLayer: false, geocoder: false, animation: false, timeline: false, sceneModePicker: false, homeButton: false, navigationHelpButton: false, selectionIndicator: false, infoBox: false });
        viewer.scene.backgroundColor = Cesium.Color.BLACK;
        viewer.scene.fog.enabled = false;
        viewer.scene.light = new Cesium.SunLight();
        const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(2684829, { enableCollision: true });
        if (disposed) { tileset.destroy(); return; }
        viewer.scene.primitives.add(tileset);
        viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(23.473, 0.674, 100000, Cesium.Ellipsoid.MOON), duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2 });
        setStatus('Apollo 11 region. Click the surface to query elevation.');
        const topology = createLunarTopology(viewer);
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction(async (event: { position: Cesium.Cartesian2 }) => {
          const request = ++sequence;
          const point = topology.getSurfacePointFromClick(event.position);
          if (!point) { setStatus('No surface hit. Click the illuminated lunar surface.'); return; }
          setStatus(`${point.lat.toFixed(6)}°, ${point.lon.toFixed(6)}° · rendered height ${point.elevationMeters.toFixed(2)} m; sampling…`);
          try {
            const elevation = await topology.getLunarElevation(point.lat, point.lon);
            if (!disposed && request === sequence) setStatus(`${point.lat.toFixed(6)}°, ${point.lon.toFixed(6)}° · ${elevation.toFixed(2)} m relative to the Moon sphere`);
          } catch (error) { if (!disposed && request === sequence) setStatus(String(error)); }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      } catch (error) { if (!disposed) setStatus(`Moon viewer unavailable: ${String(error)}`); }
    }
    void start();
    return () => { disposed = true; handler?.destroy(); if (viewer && !viewer.isDestroyed()) viewer.destroy(); };
  }, []);
  return <main><a href="./">Back to mission planner</a><div ref={container} style={{ height: '80vh', width: '100%' }} /><p role="status">{status}</p><p>Cesium Moon · ion asset 2684829. Heights reflect the dataset resolution and accuracy.</p></main>;
}
