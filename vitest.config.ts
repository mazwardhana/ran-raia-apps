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
    // Bawaan vitest 5s terlalu sempit: halaman dengan modal bertab + Select
    // bisa butuh >5s saat 20 file test berjalan paralel, lalu gagal sebagai
    // timeout yang tidak stabil (gagal di satu run, lulus di run berikutnya).
    testTimeout: 20000,
    hookTimeout: 20000,
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