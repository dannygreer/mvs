import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config({ path: '.env.local' });

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
