import { randomUUID } from 'node:crypto';
import withSerwistInit from '@serwist/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Registrasi SW sengaja dimatikan (`register: false`): next-pwa dulu menyuntik
// registrasi ke entry `main.js` (Pages Router) sehingga di App Router SW tidak
// pernah terdaftar. Kita daftarkan eksplisit di ServiceWorkerRegistrar supaya
// bug kelas itu tidak bisa terulang.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  register: false,
  // `/offline` bukan file di public/, jadi harus didaftarkan manual agar ikut
  // diprecache. Tanpa ini `fallbacks` di sw.ts tidak punya respons untuk dipakai.
  additionalPrecacheEntries: [{ url: '/offline', revision: randomUUID() }],
  // `skipWaiting` bukan opsi @serwist/next; diatur di src/app/sw.ts.
  // Nilainya false agar SW baru menunggu, bukan mengambil alih tab terbuka
  // di tengah proses checkout/KYC.
});

export default withSerwist(nextConfig);
