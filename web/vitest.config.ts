import { defineConfig } from 'vitest/config';
import { engineFingerprint } from '../app/sim/scripts/engine-fingerprint';
export default defineConfig({
  define: {__LANDING_ENGINE_SHA__: JSON.stringify(engineFingerprint())},
  esbuild: { jsx: 'automatic' },
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  // The suite loads every real terrain pack and flies full descents in parallel workers; on a busy
  // machine the heavier tests pass 5 s without being wrong.
  test: { include: ['src/**/*.test.{ts,tsx}', '../app/sim/test/**/*.test.{ts,tsx}'], testTimeout: 20_000 },
});
