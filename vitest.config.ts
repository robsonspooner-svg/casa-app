import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/**/*.test.{ts,tsx}', 'apps/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
