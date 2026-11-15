import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { engineFingerprint } from '../app/sim/scripts/engine-fingerprint';
export default defineConfig({
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/'), __LANDING_ENGINE_SHA__: JSON.stringify(engineFingerprint()) },
  plugins: [react(), viteStaticCopy({ targets: ['Workers', 'Assets', 'Widgets', 'ThirdParty'].map(dir => ({
    // The plugin keeps the source path in the output; drop node_modules/cesium/Build/Cesium so the
    // files land at /cesium/Assets, /cesium/Workers, ... where CESIUM_BASE_URL looks for them.
    src: `node_modules/cesium/Build/Cesium/${dir}`, dest: 'cesium', rename: { stripBase: 4 } })) })],
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  server: { fs: { allow: ['..'] } },
  build: { rollupOptions: { output: { manualChunks(id) {
    // Vite's dynamic-import helper is shared by every lazy chunk. Left alone, Rollup put it inside the
    // 4.2 MB Cesium chunk, so the entry imported all of Cesium before the title could paint.
    if (id.includes('vite/preload-helper')) return 'preload';
    if (id.includes('/node_modules/three/') && !id.includes('/examples/')) return 'globe';
    // The site catalog is 2.6 MB of data; keep it out of the app code so a code change does not
    // make every player download it again.
    if (id.endsWith('/public/sites.json')) return 'catalog';
    if (id.includes('/node_modules/cesium/') || id.includes('/node_modules/@cesium/')) return 'cesium';
    // The latest physics catalog retains full seasonal provenance. Keep those
    // records cached separately and load them with descent, not the first globe.
    if (id.includes('/data/environment/') && id.endsWith('.json')) return `environment-${id.split('/').pop()!.replace('.json', '')}`;
  } } } },
});
