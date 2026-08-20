import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Mongo-backed integration suites share one in-memory server; run files serially
    // so they cannot race on the same collections.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    setupFiles: ['tests/helpers/setup.ts'],
  },
});
