import { Button, Center, Container, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

/**
 * Fallback halaman saat pengguna membuka aplikasi tanpa koneksi internet
 * (dipasang sebagai `document` fallback oleh Serwist).
 */
export default function OfflinePage() {
  return (
    <Center mih="100dvh" px="md">
      <Container size="xs">
        <Stack align="center" gap="md" ta="center">
          <Title order={1}>Anda sedang tidak tersambung</Title>
          <Text c="dimmed">
            Koneksi internet terputus, jadi data terbaru belum bisa dimuat.
            Silakan coba lagi saat jaringan Anda kembali.
          </Text>
          <Button
            component={Link}
            href="/"
            variant="light"
            size="md"
            aria-label="Kembali ke beranda"
          >
            Kembali ke beranda
          </Button>
        </Stack>
      </Container>
    </Center>
  );
}
