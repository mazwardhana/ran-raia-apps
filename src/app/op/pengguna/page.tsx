import { Box, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth';

import { UserConsole } from './UserConsole';

export const dynamic = 'force-dynamic';

export default async function OperatorUsersPage() {
  let sessionRole: string;
  try {
    const user = await requireRole(['OPERATOR', 'ADMIN']);
    sessionRole = user.role;
  } catch {
    redirect('/app');
  }

  return (
    <Box p="md">
      <Stack gap="md">
        <div>
          <Title order={1}>Pengguna</Title>
          <Text size="sm" c="dimmed">
            Kelola status KYC dan role pengguna. Perubahan role hanya dapat
            dilakukan oleh admin.
          </Text>
        </div>
        <UserConsole sessionRole={sessionRole} />
      </Stack>
    </Box>
  );
}
