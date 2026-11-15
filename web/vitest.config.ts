import { defineConfig } from 'vitest/config';
import { engineFingerprint } from '../app/sim/scripts/engine-fingerprint';
export default defineConfig({
  define: {__LANDING_ENGINE_SHA__: JSON.stringify(engineFingerprint())},
  esbuild: { jsx: 'automatic' },
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  // The catalog now has 151 sites; tests that load every terrain pack need more than the 5 s default on slower machines and CI.
  test: { include: ['src/**/*.test.{ts,tsx}', '../app/sim/test/**/*.test.{ts,tsx}'], testTimeout: 20000 },
});
