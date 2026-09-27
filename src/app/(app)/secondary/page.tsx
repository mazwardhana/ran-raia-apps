import { Box, Title } from '@mantine/core';

import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default function SecondaryPage() {
  return (
    <Box p="md">
      <Title order={1} mb="md">
        Secondary Market
      </Title>
      <EmptyState
        title="Halaman ini sedang disiapkan"
        description="Halaman secondary market sedang dibangun dan akan segera tersedia."
      />
    </Box>
  );
}
