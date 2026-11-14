import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Dev-only viewer for the physics engine: npm run viewer
// fs.allow reaches the repo root so the viewer can load terrain packs from web/public/terrain/.
export default defineConfig({
  plugins: [react()],
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../../web/public', import.meta.url)),
  server: { port: 5199, open: true, fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] } },
});
