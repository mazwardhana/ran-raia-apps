'use client';

import {
  Alert,
  Button,
  Card,
  Center,
  Code,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

type SimulateAction = 'success' | 'cancel';

export default function BayarSimulasiPage({
  params,
}: {
  params: { orderId: string };
}) {
  const { orderId } = params;

  const [submitting, setSubmitting] = useState<SimulateAction | null>(null);
  const [result, setResult] = useState<SimulateAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate(action: SimulateAction) {
    if (submitting) return;
    setSubmitting(action);
    setError(null);

    try {
      const res = await fetch('/api/payments/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Gagal memproses simulasi pembayaran.');
        return;
      }

      setResult(action);
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setSubmitting(null);
    }
  }

  if (result === 'success') {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <ThemeIcon size={48} radius="xl" color="green" variant="light">
            <IconCircleCheck size={28} />
          </ThemeIcon>
          <Title order={3}>Pembayaran berhasil</Title>
          <Text c="dimmed" ta="center">
            Pesanan <b>{orderId}</b> ditandai lunas (mode simulasi).
          </Text>
          <Button component={Link} href="/app/transaksi" miw={200} mih={44}>
            Lihat transaksi saya
          </Button>
        </Stack>
      </Center>
    );
  }

  if (result === 'cancel') {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <ThemeIcon size={48} radius="xl" color="red" variant="light">
            <IconCircleX size={28} />
          </ThemeIcon>
          <Title order={3}>Pesanan dibatalkan</Title>
          <Text c="dimmed" ta="center">
            Slot untuk pesanan <b>{orderId}</b> sudah dikembalikan.
          </Text>
          <Button component={Link} href="/app/paket" miw={200} mih={44}>
            Lihat paket lain
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={3}>Simulasi pembayaran</Title>
        <Text c="dimmed" size="sm">
          Mode simulasi aktif — Midtrans tidak dipanggil. Gunakan tombol di bawah
          untuk meniru hasil pembayaran.
        </Text>
      </div>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Nomor pesanan
          </Text>
          <Code>{orderId}</Code>
          <Text size="xs" c="dimmed">
            &quot;Bayar berhasil&quot; menandai pesanan lunas; &quot;Batalkan&quot;
            mengembalikan slot lot yang dipesan.
          </Text>
        </Stack>
      </Card>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Simulasi gagal">
          {error}
        </Alert>
      )}

      <Group>
        <Button
          color="green"
          onClick={() => simulate('success')}
          loading={submitting === 'success'}
          disabled={submitting === 'cancel'}
          mih={44}
        >
          Bayar berhasil
        </Button>
        <Button
          color="red"
          variant="light"
          onClick={() => simulate('cancel')}
          loading={submitting === 'cancel'}
          disabled={submitting === 'success'}
          mih={44}
        >
          Batalkan
        </Button>
      </Group>
    </Stack>
  );
}
