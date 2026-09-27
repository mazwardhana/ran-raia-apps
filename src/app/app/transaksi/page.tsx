import { Box, Title } from '@mantine/core';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { TransaksiTable } from './TransaksiTable';

export const dynamic = 'force-dynamic';

export default async function TransaksiPage() {
  const user = await getCurrentUser();

  const rows = user
    ? await prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <Box p="md">
      <Title order={1} mb="md">
        Transaksi
      </Title>
      <TransaksiTable rows={rows} />
    </Box>
  );
}
