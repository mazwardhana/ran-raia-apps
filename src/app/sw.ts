/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from 'serwist';

// `__SW_MANIFEST` diisi @serwist/next saat build (injeksi manifest precache).
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // SW baru menunggu, tidak langsung mengambil alih tab yang sedang terbuka.
  // Di jalur uang (checkout/KYC) ini mencegah aset tertukar di tengah proses.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Aset statis → cache dulu, hemat bandwidth.
      matcher: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
      handler: new CacheFirst({
        cacheName: 'static-assets',
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
        ],
      }),
    },
    {
      // API aplikasi → coba jaringan dulu, baru cache.
      // Kecuali API sensitif (auth, pembayaran, KYC) yang ditangani NetworkOnly di bawah.
      matcher: ({ url }) =>
        url.pathname.startsWith('/api/') &&
        !/^\/api\/(auth|payments|kyc)/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: 'api-cache',
        networkTimeoutSeconds: 8,
        plugins: [
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
        ],
      }),
    },
    {
      // API sensitif (autentikasi, pembayaran & identitas/KYC) tidak pernah masuk cache.
      // Keputusan tetap untuk aplikasi keuangan.
      matcher: ({ url }) => /^\/api\/(auth|payments|kyc)/.test(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      // Halaman navigasi → coba jaringan dulu, fallback ke cache bila offline.
      matcher: ({ request }) => request.destination === 'document',
      handler: new NetworkFirst({
        cacheName: 'pages',
        networkTimeoutSeconds: 8,
        plugins: [
          new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }),
        ],
      }),
    },
  ],
  // Halaman offline harus sudah diprecache (lihat additionalPrecacheEntries di next.config.mjs).
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
