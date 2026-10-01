import type { Metadata, Viewport } from 'next';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './globals.css';
import { theme } from '@/theme/theme';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'Raia - Investasi Ternak',
  description: 'Platform investasi ternak gotong royong: kelola paket ternak, pantau profit, dan likuiditas melalui secondary market.',
  keywords: ['investasi ternak', 'jasa gaduh', 'kambing etawa', 'sapi limosin', 'gotong royong'],
  // PWA: biar bisa di-install dari homescreen.
  manifest: '/manifest.json',
  applicationName: 'Raia',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Raia',
  },
  // iOS "Add to Home Screen" butuh apple-touch-icon; tanpa ini iOS memakai screenshot halaman.
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-icon.png',
  },
};

// Next 14 mengabaikan `themeColor` bila ditaruh di `metadata`; wajib di `viewport`.
// `viewportFit: 'cover'` prasyarat agar `env(safe-area-inset-*)` berfungsi.
export const viewport: Viewport = {
  themeColor: '#0F766E',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><ColorSchemeScript defaultColorScheme="light" /></head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications position="top-center" />
          <ServiceWorkerRegistrar />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
