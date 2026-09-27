import { Box, Title } from '@mantine/core';

import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default function PortofolioPage() {
  return (
    <Box p="md">
      <Title order={1} mb="md">
        Portofolio
      </Title>
      <EmptyState
        title="Halaman ini sedang disiapkan"
        description="Halaman portofolio sedang dibangun dan akan segera tersedia."
      />
    </Box>
  );
}
