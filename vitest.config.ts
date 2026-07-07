import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const serverOnlyStub = fileURLToPath(new URL('./test/setup/empty-module.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Backend modules mark themselves server-only; stub it so Node/Vitest can
      // import them for smoke tests (the real Next build still enforces it).
      'server-only': serverOnlyStub,
      '@': srcDir
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
    // A single JSON bundle (questions.json) can be large; keep a generous timeout.
    testTimeout: 20000
  }
});
