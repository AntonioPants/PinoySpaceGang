import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
export default defineConfig({
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
  plugins: [react(), viteStaticCopy({ targets: ['Workers', 'Assets', 'Widgets', 'ThirdParty'].map(dir => ({ src: `node_modules/cesium/Build/Cesium/${dir}`, dest: 'cesium' })) })],
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  server: { fs: { allow: ['..'] } },
  build: { rollupOptions: { output: { manualChunks(id) {
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
