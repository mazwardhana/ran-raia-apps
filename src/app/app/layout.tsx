import type { Metadata } from 'next';

import { AppShell } from '@/components/shared/AppShell';

export const metadata: Metadata = {
  title: 'Raia - Aplikasi Investor',
  description:
    'Platform investasi ternak gotong royong: kelola paket ternak, pantau profit, dan likuiditas melalui secondary market.',
};

export default function InvestorAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
