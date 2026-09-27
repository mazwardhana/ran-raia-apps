import { Box, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { ErrorState } from '@/components/ui/ErrorState';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { SettingsClient } from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function OperatorSettingsPage() {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch {
    redirect('/');
  }

  try {
    const rows = await prisma.setting.findMany({ orderBy: { id: 'asc' } });

    return (
      <Box p="md">
        <Stack gap="md">
          <div>
            <Title order={1}>Pengaturan</Title>
            <Text size="sm" c="dimmed">
              Nilai di bawah dipakai langsung oleh checkout, pembagian profit,
              dan klaim ta&apos;awun. Perubahan tersimpan per baris.
            </Text>
          </div>
          <SettingsClient
            items={rows.map((row) => ({ key: row.id, value: row.value }))}
          />
        </Stack>
      </Box>
    );
  } catch (error) {
    console.error('Gagal memuat halaman pengaturan:', error);
    return (
      <Box p="md">
        <Stack gap="md">
          <Title order={1}>Pengaturan</Title>
          <ErrorState
            title="Gagal memuat pengaturan"
            description="Data tidak dapat diambil dari server. Muat ulang halaman untuk mencoba lagi."
          />
        </Stack>
      </Box>
    );
  }
}
