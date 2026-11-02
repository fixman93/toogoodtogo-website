import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Model files register their schema with mongoose on import; running test files
    // in sequence (not parallel workers) avoids "Cannot overwrite model" races.
    fileParallelism: false,
  },
})
