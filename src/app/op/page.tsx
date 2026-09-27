import { Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

import { OverviewChart, type StatusCount } from '@/components/operator/OverviewChart';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draf',
  OPEN: 'Dibuka',
  RUNNING: 'Berjalan',
  CLOSED: 'Ditutup',
  SOLD_OUT: 'Habis',
};

interface MetricCardProps {
  label: string;
  value: number;
  hint: string;
}

function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <Card withBorder>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="xl">
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
    </Card>
  );
}

const QUICK_LINKS = [
  { href: '/op/site-projects', label: 'Site Project' },
  { href: '/op/paket', label: 'Paket' },
  { href: '/op/ternak', label: 'Ternak' },
  { href: '/op/settings', label: 'Pengaturan' },
];

export default async function OperatorOverviewPage() {
  const [
    openPackages,
    runningPackages,
    investors,
    livestock,
    pendingKyc,
    statusGroups,
  ] = await Promise.all([
    prisma.package.count({ where: { status: 'OPEN' } }),
    prisma.package.count({ where: { status: 'RUNNING' } }),
    prisma.user.count({ where: { role: 'INVESTOR' } }),
    prisma.livestock.count(),
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    prisma.package.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const chartData: StatusCount[] = statusGroups.map((group) => ({
    status: STATUS_LABELS[group.status] ?? group.status,
    jumlah: group._count._all,
  }));

  return (
    <Stack gap="md" maw={1100}>
      <div>
        <Title order={2}>Ringkasan operasional</Title>
        <Text c="dimmed" size="sm">
          Pantau paket, investor, ternak, dan verifikasi KYC.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <MetricCard
          label="Paket dibuka"
          value={openPackages}
          hint={openPackages === 0 ? 'Belum ada paket yang dibuka' : 'Siap menerima pembelian'}
        />
        <MetricCard
          label="Paket berjalan"
          value={runningPackages}
          hint={runningPackages === 0 ? 'Belum ada paket berjalan' : 'Sedang beroperasi'}
        />
        <MetricCard
          label="Investor terdaftar"
          value={investors}
          hint={investors === 0 ? 'Belum ada investor' : 'Akun investor aktif'}
        />
        <MetricCard
          label="Ternak terdaftar"
          value={livestock}
          hint={livestock === 0 ? 'Belum ada ternak' : 'Ternak tercatat di sistem'}
        />
        <MetricCard
          label="KYC menunggu verifikasi"
          value={pendingKyc}
          hint={
            pendingKyc === 0
              ? 'Tidak ada KYC yang menunggu'
              : 'Perlu ditinjau oleh operator'
          }
        />
      </SimpleGrid>

      <Card withBorder>
        <Text fw={600} mb="xs">
          Paket per status
        </Text>
        <OverviewChart data={chartData} />
      </Card>

      <Card withBorder>
        <Text fw={600} mb="xs">
          Kelola
        </Text>
        <Group gap="xs">
          {QUICK_LINKS.map((link) => (
            <Button
              key={link.href}
              component={Link}
              href={link.href}
              variant="light"
              style={{ minHeight: 44 }}
            >
              {link.label}
            </Button>
          ))}
        </Group>
      </Card>
    </Stack>
  );
}
