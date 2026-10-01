'use client';

import { Button, Center, Container, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Center mih="100dvh" px="md">
      <Container size="xs">
        <Stack align="center" gap="md" ta="center">
          <IconAlertTriangle
            size={48}
            stroke={1.5}
            color="var(--mantine-color-red-6)"
            aria-hidden="true"
          />
          <Title order={1}>Terjadi gangguan</Title>
          <Text c="dimmed">
            Halaman ini gagal dimuat. Silakan coba lagi; kalau masih gagal, tutup lalu
            buka kembali aplikasi.
          </Text>
          {error.digest && (
            <Text size="xs" c="dimmed">
              Kode kesalahan: {error.digest}
            </Text>
          )}
          <Button onClick={reset} size="md">
            Coba lagi
          </Button>
        </Stack>
      </Container>
    </Center>
  );
}
