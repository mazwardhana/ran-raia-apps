import type { Metadata } from 'next';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './globals.css';
import { theme } from '@/theme/theme';

export const metadata: Metadata = {
  title: 'Raia - Investasi Ternak',
  description: 'Platform investasi ternak gotong royong: kelola paket ternak, pantau profit, dan likuiditas melalui secondary market.',
  keywords: ['investasi ternak', 'jasa gaduh', 'kambing etawa', 'sapi limosin', 'gotong royong'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><ColorSchemeScript defaultColorScheme="light" /></head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
