import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  server: { fs: { allow: ['..'] } },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('/node_modules/three/') && !id.includes('/examples/')) return 'globe';
    // The latest physics catalog retains full seasonal provenance. Keep those
    // records cached separately and load them with descent, not the first globe.
    if (id.includes('/data/environment/') && id.endsWith('.json')) return `environment-${id.split('/').pop()!.replace('.json', '')}`;
  } } } },
});
