'use client';

import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconCash, IconCoins, IconGift, IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatRupiah } from '@/lib/calculations';

export interface TaawunRow extends Record<string, unknown> {
  id: string;
  investor: string;
  paket: string;
  jumlah: string;
  tahun: string;
  status: string;
  statusLabel: string;
  alasan: string;
  dibuat: string;
}

export interface TaawunMetrics {
  terkumpul: number;
  terkumpulAdaData: boolean;
  diklaim: number;
  diklaimCount: number;
  totalBaris: number;
}

export interface TaawunInvestor {
  value: string;
  label: string;
}

export interface TaawunPackage {
  value: string;
  label: string;
}

const COLUMNS: DataTableColumn<TaawunRow>[] = [
  { accessorKey: 'investor', header: 'Investor' },
  { accessorKey: 'paket', header: 'Paket' },
  { accessorKey: 'jumlah', header: 'Jumlah' },
  { accessorKey: 'tahun', header: 'Tahun ke-' },
  { accessorKey: 'statusLabel', header: 'Status' },
];

const YEAR_OPTIONS = [
  { value: '1', label: 'Tahun ke-1' },
  { value: '2', label: 'Tahun ke-2 atau lebih' },
];

export function TaawunClient({
  rows,
  metrics,
  rates,
  investors,
  packages,
}: {
  rows: TaawunRow[];
  metrics: TaawunMetrics;
  rates: { year1: number; year2: number };
  investors: TaawunInvestor[];
  packages: TaawunPackage[];
}) {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [opened, setOpened] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);
  const [year, setYear] = useState('1');
  const [amount, setAmount] = useState<number | string>(rates.year1);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const maxForYear = year === '1' ? rates.year1 : rates.year2;
  const amountNumber = typeof amount === 'number' ? amount : Number(amount) || 0;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const collLabel = useMemo(
    () => (metrics.terkumpulAdaData ? 'Terkumpul (biaya ta\'awun)' : 'Terkumpul (belum ada data)'),
    [metrics.terkumpulAdaData]
  );

  function openModal() {
    setFormError(null);
    setUserId(null);
    setPackageId(null);
    setYear('1');
    setAmount(rates.year1);
    setReason('');
    setOpened(true);
  }

  function changeYear(value: string | null) {
    const next = value ?? '1';
    setYear(next);
    setAmount(next === '1' ? rates.year1 : rates.year2);
  }

  async function submit() {
    setFormError(null);
    setNotice(null);

    if (!userId) {
      setFormError('Investor wajib dipilih');
      return;
    }
    if (!packageId) {
      setFormError('Paket wajib dipilih');
      return;
    }
    if (!Number.isInteger(amountNumber) || amountNumber <= 0) {
      setFormError('Jumlah klaim harus berupa bilangan bulat lebih dari 0');
      return;
    }
    if (amountNumber > maxForYear) {
      setFormError(
        `Jumlah klaim melebihi batas ta'awun tahun ke-${year === '1' ? '1' : '2'} (${formatRupiah(maxForYear)})`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/taawun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          packageId,
          amount: amountNumber,
          year: Number(year),
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json.error || 'Gagal memproses klaim ta\'awun');
        return;
      }

      setNotice(
        `Klaim ${formatRupiah(amountNumber)} dibayar penuh ke saldo investor.`
      );
      setOpened(false);
      router.refresh();
    } catch {
      setFormError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <MetricCard
          icon={<IconCoins size={20} color="var(--mantine-color-yellow-6)" />}
          label={collLabel}
          value={formatRupiah(metrics.terkumpul)}
        />
        <MetricCard
          icon={<IconCash size={20} color="var(--mantine-color-teal-6)" />}
          label="Ta'awun diklaim (dibayar)"
          value={formatRupiah(metrics.diklaim)}
        />
        <MetricCard
          icon={<IconGift size={20} color="var(--mantine-color-blue-6)" />}
          label="Jumlah klaim"
          value={`${metrics.diklaimCount} klaim`}
        />
      </SimpleGrid>

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={600}>Riwayat klaim</Text>
          <Text size="xs" c="dimmed">
            {metrics.totalBaris > 0
              ? `${metrics.totalBaris} klaim tercatat (maksimal 200).`
              : 'Belum ada klaim ta\'awun yang tercatat.'}
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={18} />}
          onClick={openModal}
          h={44}
        >
          Klaim Ta&apos;awun
        </Button>
      </Group>

      {notice && (
        <Alert
          color="green"
          variant="light"
          title="Berhasil"
          onClose={() => setNotice(null)}
        >
          {notice}
        </Alert>
      )}

      <DataTable<TaawunRow>
        data={paged}
        columns={COLUMNS}
        total={rows.length}
        page={safePage}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <BaseModal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Klaim Ta'awun"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Klaim dibayar 100% ke saldo investor. Rate:{' '}
            {formatRupiah(rates.year1)} (tahun ke-1),{' '}
            {formatRupiah(rates.year2)} (tahun ke-2 ke atas).
          </Text>

          {formError && (
            <Alert color="red" variant="light" title="Gagal memproses">
              {formError}
            </Alert>
          )}

          <SearchableSelect
            label="Investor"
            placeholder="Ketik nama investor"
            data={investors}
            value={userId}
            onChange={setUserId}
            nothingFoundMessage="Investor tidak ditemukan"
            required
          />

          <SearchableSelect
            label="Paket"
            placeholder="Ketik kode atau nama paket"
            data={packages}
            value={packageId}
            onChange={setPackageId}
            nothingFoundMessage="Paket tidak ditemukan"
            required
          />

          <Select
            label="Tahun ke-"
            data={YEAR_OPTIONS}
            value={year}
            onChange={changeYear}
            styles={{ input: { minHeight: 44 } }}
            comboboxProps={{ keepMounted: false }}
          />

          <NumberInput
            label={`Jumlah klaim (Rp) — maks ${formatRupiah(maxForYear)}`}
            value={amount}
            onChange={setAmount}
            min={0}
            step={10000}
            required
            styles={{ input: { minHeight: 44 } }}
          />

          <TextInput
            label="Alasan (opsional)"
            placeholder="Contoh: biaya pengobatan"
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            styles={{ input: { minHeight: 44 } }}
          />

          <Paper withBorder p="sm" bg="gray.0">
            <Group justify="space-between">
              <Text size="sm">Dibayar ke saldo investor</Text>
              <Text size="sm" fw={700}>
                {formatRupiah(amountNumber)}
              </Text>
            </Group>
          </Paper>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)} h={44}>
              Batal
            </Button>
            <Button onClick={submit} loading={submitting} h={44}>
              Bayar Klaim
            </Button>
          </Group>
        </Stack>
      </BaseModal>
    </Stack>
  );
}
