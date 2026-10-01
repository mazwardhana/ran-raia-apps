import { Box, Container, Group, Stack, Text, Anchor, Divider } from '@mantine/core';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PublicNav } from '@/components/landing/PublicNav';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Stack gap={0} style={{ minHeight: '100vh' }}>
      <Box
        component="header"
        py="md"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Container size="lg">
          <Group justify="space-between" align="center">
            <Anchor component={Link} href="/" c="dark" fw={700} size="xl" underline="never">
              Raia
            </Anchor>
            <PublicNav />
          </Group>
        </Container>
      </Box>

      <Box component="main" style={{ flex: 1 }}>
        {children}
      </Box>

      <Box
        component="footer"
        py="xl"
        mt="xl"
        style={{
          borderTop: '1px solid var(--mantine-color-gray-3)',
          backgroundColor: 'var(--mantine-color-gray-0)',
        }}
      >
        <Container size="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" gap="xl">
              <Stack gap="xs">
                <Text fw={700} size="lg">Raia</Text>
                <Text size="sm" c="dimmed">Platform investasi ternak digital</Text>
              </Stack>
              <Group gap="xl" align="flex-start">
                <Stack gap="xs">
                  <Text fw={600} size="sm">Platform</Text>
                  <Anchor component={Link} href="/" size="sm" c="dimmed" underline="hover">Beranda</Anchor>
                  <Anchor component={Link} href="/paket" size="sm" c="dimmed" underline="hover">Paket</Anchor>
                  <Anchor component={Link} href="/artikel" size="sm" c="dimmed" underline="hover">Artikel</Anchor>
                  <Anchor component={Link} href="/syarat-ketentuan" size="sm" c="dimmed" underline="hover">Syarat & Ketentuan</Anchor>
                  <Anchor component={Link} href="/kebijakan-privasi" size="sm" c="dimmed" underline="hover">Kebijakan Privasi</Anchor>
                </Stack>
                <Stack gap="xs">
                  <Text fw={600} size="sm">Akun</Text>
                  <Anchor component={Link} href="/login" size="sm" c="dimmed" underline="hover">Masuk</Anchor>
                  <Anchor component={Link} href="/register" size="sm" c="dimmed" underline="hover">Daftar</Anchor>
                </Stack>
              </Group>
            </Group>
            <Divider />
            <Text size="xs" c="dimmed" ta="center">
              © 2026 Raia. Semua hak dilindungi.
            </Text>
          </Stack>
        </Container>
      </Box>
    </Stack>
  );
}
