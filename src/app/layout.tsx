import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ColorSchemeScript } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './globals.css';
import { Providers } from './providers';

// Plus Jakarta Sans dirancang untuk pasar Indonesia: x-height besar dan angka
// jelas, penting untuk tabel nominal rupiah. Di-self-host saat build.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: 'Raia - Investasi Ternak',
  description: 'Platform investasi ternak gotong royong: kelola paket ternak, pantau profit, dan likuiditas melalui secondary market.',
  keywords: ['investasi ternak', 'jasa gaduh', 'kambing etawa', 'sapi limosin', 'gotong royong'],
  // PWA: biar bisa di-install dari homescreen.
  manifest: '/manifest.json',
  applicationName: 'Raia',
  themeColor: '#0F766E',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Raia',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable} suppressHydrationWarning>
      <head><ColorSchemeScript defaultColorScheme="light" /></head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
