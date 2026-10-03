import { Box } from '@mantine/core';
import type { ReactNode } from 'react';

// Grup rute (auth) sengaja tidak memakai layout (public), supaya halaman
// login/register tidak ikut header, footer, dan bottom nav publik. Layout ini
// hanya menyediakan latar halaman agar kartu putih form terpisah jelas.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Box bg="gray.0" mih="100vh">
      {children}
    </Box>
  );
}
