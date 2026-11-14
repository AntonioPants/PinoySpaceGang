import { defineConfig } from 'vitest/config';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  test: { include: ['src/**/*.test.{ts,tsx}', '../app/sim/test/**/*.test.{ts,tsx}'] },
});
