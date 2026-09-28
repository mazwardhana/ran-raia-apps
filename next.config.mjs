import withPWAInit from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    {
      // Aset statis → cache dulu, hemat bandwidth.
      urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // API aplikasi → coba jaringan dulu, baru cache.
      // Kecuali API sensitif (auth, pembayaran, KYC) yang ditangani NetworkOnly di bawah.
      urlPattern: ({ url }) =>
        url.pathname.startsWith('/api/') &&
        !/^\/api\/(auth|payments|kyc)/.test(url.pathname),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 8,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      // API sensitif (autentikasi, pembayaran & identitas/KYC) tidak pernah masuk cache.
      urlPattern: ({ url }) => /^\/api\/(auth|payments|kyc)/.test(url.pathname),
      handler: 'NetworkOnly',
      // `options` wajib ada: next-pwa menelusuri c.options.precacheFallback
      // untuk setiap entri saat `fallbacks` dipakai, dan crash bila kosong.
      options: {},
    },
    {
      // Halaman navigasi → coba jaringan dulu, fallback ke cache bila offline.
      urlPattern: ({ request }) => request.destination === 'document',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 8,
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
  ],
});

export default withPWA(nextConfig);
