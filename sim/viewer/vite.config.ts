import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Dev-only viewer for the physics engine: npm run viewer
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { port: 5199, open: true, fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
});
