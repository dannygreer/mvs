import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({ path: '.env.local' });

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
