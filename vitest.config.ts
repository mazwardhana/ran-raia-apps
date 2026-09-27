import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/tests/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        // next-auth mengimpor "next/server" tanpa ekstensi — hanya Vite yang bisa me-resolve-nya.
        inline: ['next-auth', '@auth/core'],
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(rootDir, './src') },
  },
});