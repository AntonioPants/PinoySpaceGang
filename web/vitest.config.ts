import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts', '../app/sim/test/**/*.test.ts'] } });
