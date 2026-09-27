'use client';

import {
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { withdrawalSchema } from '@/lib/validation';

interface WithdrawalItem {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  bankName?: string | null;
  bankAccount?: string | null;
}

interface FormValues {
  amount: number | '';
  bankName: string;
  bankAccount: string;
  bankHolder: string;
}

const rupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);

export default function PenarikanPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      amount: '',
      bankName: '',
      bankAccount: '',
      bankHolder: '',
    },
  });

  async function loadWithdrawals() {
    const res = await fetch('/api/withdrawals');
    if (!res.ok) {
      throw new Error('load-failed');
    }
    const data = await res.json();
    setWithdrawals(Array.isArray(data.withdrawals) ? data.withdrawals : []);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadWithdrawals();
        if (!cancelled) {
          setLoadError(false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSuccessMessage(null);

    const amount = Number(values.amount);
    const amountCheck = withdrawalSchema.shape.amount.safeParse(amount);
    if (!amountCheck.success) {
      setFormError(amountCheck.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bankName: values.bankName,
          bankAccount: values.bankAccount,
          bankHolder: values.bankHolder,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(
          typeof data.error === 'string' && data.error
            ? data.error
            : 'Gagal mengajukan penarikan. Coba lagi.'
        );
        return;
      }

      setSuccessMessage('Penarikan berhasil diajukan dan sedang diproses.');
      reset({ amount: '', bankName: '', bankAccount: '', bankHolder: '' });
      try {
        await loadWithdrawals();
      } catch {
        // daftar terbaru gagal dimuat, pesan sukses tetap ditampilkan
      }
    } catch {
      setFormError('Gagal mengajukan penarikan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Stack gap="lg" maw={720} mx="auto" py="md">
      <div>
        <Text fw={700} size="xl">
          Penarikan Dana
        </Text>
        <Text size="sm" c="dimmed">
          Ajukan penarikan saldo hasil investasi Anda.
        </Text>
      </div>

      {loadError && (
        <Alert icon={<IconAlertCircle size={18} />} color="red" variant="light">
          Gagal memuat data. Muat ulang halaman.
        </Alert>
      )}

      <Card withBorder padding="lg" radius="md">
        <form onSubmit={onSubmit} noValidate>
          <Stack gap="md">
            <TextInput
              label="Jumlah Penarikan"
              placeholder="Contoh: 100000"
              description="Minimal Rp50.000"
              withAsterisk
              type="number"
              inputMode="numeric"
              styles={{ input: { minHeight: 44 } }}
              {...register('amount')}
            />
            <TextInput
              label="Nama Bank"
              placeholder="Contoh: Bank BSI"
              styles={{ input: { minHeight: 44 } }}
              {...register('bankName')}
            />
            <TextInput
              label="Nomor Rekening"
              placeholder="Contoh: 1234567890"
              inputMode="numeric"
              styles={{ input: { minHeight: 44 } }}
              {...register('bankAccount')}
            />
            <TextInput
              label="Nama Pemilik Rekening"
              placeholder="Sesuai buku tabungan"
              styles={{ input: { minHeight: 44 } }}
              {...register('bankHolder')}
            />

            {formError && (
              <Alert
                icon={<IconAlertCircle size={18} />}
                color="red"
                variant="light"
                role="alert"
              >
                {formError}
              </Alert>
            )}

            {successMessage && (
              <Alert
                icon={<IconCheck size={18} />}
                color="green"
                variant="light"
                role="status"
              >
                {successMessage}
              </Alert>
            )}

            <Button
              type="submit"
              loading={submitting}
              fullWidth
              size="md"
              mih={44}
            >
              Ajukan Penarikan
            </Button>
          </Stack>
        </form>
      </Card>

      <div>
        <Text fw={600} size="lg" mb="sm">
          Riwayat Penarikan
        </Text>

        {loading ? (
          <LoadingState text="Memuat riwayat penarikan..." />
        ) : withdrawals.length === 0 ? (
          <Text size="sm" c="dimmed">
            Belum ada permintaan penarikan.
          </Text>
        ) : (
          <Stack gap="sm">
            {withdrawals.map((item) => (
              <Card key={item.id} withBorder padding="md" radius="md">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={4}>
                    <Text fw={600} size="sm">
                      {rupiah(item.amount)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.bankName || 'Bank'}
                      {item.bankAccount ? ` • ${item.bankAccount}` : ''}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(item.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                  </Stack>
                  <StatusBadge status={item.status} />
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </div>
    </Stack>
  );
}
