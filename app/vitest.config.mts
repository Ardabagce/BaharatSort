import { defineConfig } from 'vitest/config';

// Yalnızca saf modüller (React Native'siz) test edilir.
export default defineConfig({
  test: { name: 'app', include: ['src/**/*.test.ts'], environment: 'node' },
});
