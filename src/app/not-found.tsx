import { Button, Center, Container, Stack, Text, Title } from '@mantine/core';
import { IconMapOff } from '@tabler/icons-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Center mih="100dvh" px="md">
      <Container size="xs">
        <Stack align="center" gap="md" ta="center">
          <IconMapOff
            size={48}
            stroke={1.5}
            color="var(--mantine-color-gray-6)"
            aria-hidden="true"
          />
          <Title order={1}>Halaman tidak ditemukan</Title>
          <Text c="dimmed">
            Alamat yang Anda tuju tidak tersedia atau sudah dipindahkan. Periksa kembali
            tautannya, atau kembali ke beranda untuk melanjutkan.
          </Text>
          <Button component={Link} href="/" size="md">
            Kembali ke beranda
          </Button>
        </Stack>
      </Container>
    </Center>
  );
}
