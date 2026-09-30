import { Box, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth';

import { WithdrawalConsole } from './WithdrawalConsole';

export const dynamic = 'force-dynamic';

export default async function OperatorWithdrawalPage() {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch {
    redirect('/app');
  }

  return (
    <Box p="md">
      <Stack gap="md">
        <div>
          <Title order={1}>Penarikan Dana</Title>
          <Text size="sm" c="dimmed">
            Tinjau permintaan penarikan investor: setujui, tolak, atau tandai
            sudah dibayar.
          </Text>
        </div>
        <WithdrawalConsole />
      </Stack>
    </Box>
  );
}
