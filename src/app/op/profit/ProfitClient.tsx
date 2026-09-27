'use client';

import { BarChart } from '@mantine/charts';
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { IconCash, IconClock, IconPlus, IconWallet } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { ChartCard } from '@/components/ui/ChartCard';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { calcProfitSplit, formatRupiah } from '@/lib/calculations';

export interface ProfitRow extends Record<string, unknown> {
  id: string;
  packageId: string;
  periode: string;
  paket: string;
  sumber: string;
  nilaiKotor: string;
  bagianInvestor: string;
  bagianRaia: string;
  status: string;
  statusLabel: string;
  catatan: string;
  dibuat: string;
}

export interface ChartPoint {
  period: string;
  total: number;
  investor: number;
}

export interface ProfitMetrics {
  period: string;
  didistribusikan: number;
  didistribusikanCount: number;
  bagianInvestor: number;
  menunggu: number;
  menungguCount: number;
  totalBaris: number;
}

interface PackageOption {
  id: string;
  code: string;
  title: string;
}

const COLUMNS: DataTableColumn<ProfitRow>[] = [
  { accessorKey: 'periode', header: 'Periode' },
  { accessorKey: 'paket', header: 'Paket' },
  { accessorKey: 'sumber', header: 'Sumber' },
  { accessorKey: 'nilaiKotor', header: 'Nilai kotor' },
  { accessorKey: 'bagianInvestor', header: 'Bagian investor' },
  { accessorKey: 'statusLabel', header: 'Status' },
];

const SOURCE_OPTIONS = [
  { value: 'OFFSPRING', label: 'Anak (offspring)' },
  { value: 'MILK', label: 'Susu (milk)' },
  { value: 'OTHER', label: 'Lainnya' },
];

export function ProfitClient({
  rows,
  metrics,
  chartData,
  shares,
}: {
  rows: ProfitRow[];
  metrics: ProfitMetrics;
  chartData: ChartPoint[];
  shares: { raiaPercent: number; investorPercent: number };
}) {
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [opened, setOpened] = useState(false);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);

  const [packageId, setPackageId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | string>('');
  const [source, setSource] = useState<string>('OFFSPRING');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selected, setSelected] = useState<ProfitRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const amountNumber = typeof amount === 'number' ? amount : Number(amount) || 0;
  const split = useMemo(
    () =>
      amountNumber > 0
        ? calcProfitSplit(Math.round(amountNumber), shares.raiaPercent)
        : null,
    [amountNumber, shares.raiaPercent]
  );

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;

    async function loadPackages() {
      setPackagesLoading(true);
      setPackagesError(null);
      try {
        const res = await fetch('/api/packages?pageSize=100');
        if (!res.ok) throw new Error('gagal');
        const json = await res.json();
        if (!cancelled) setPackages(json.items ?? []);
      } catch {
        if (!cancelled)
          setPackagesError('Daftar paket gagal dimuat. Coba lagi.');
      } finally {
        if (!cancelled) setPackagesLoading(false);
      }
    }

    loadPackages();
    return () => {
      cancelled = true;
    };
  }, [opened]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (row) =>
        row.paket.toLowerCase().includes(q) ||
        row.periode.includes(q) ||
        row.sumber.toLowerCase().includes(q) ||
        row.statusLabel.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function submit() {
    setFormError(null);
    setNotice(null);

    if (!packageId) {
      setFormError('Paket wajib dipilih');
      return;
    }
    if (!Number.isInteger(amountNumber) || amountNumber <= 0) {
      setFormError('Nominal harus berupa bilangan bulat lebih dari 0');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/profit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          amount: amountNumber,
          source,
          period: metrics.period,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json.error || 'Gagal menyimpan distribusi profit');
        return;
      }

      setNotice(
        `Distribusi ${formatRupiah(amountNumber)} tersimpan — Raia ${formatRupiah(
          split?.raia ?? 0
        )}, investor ${formatRupiah(split?.investor ?? 0)}.`
      );
      setOpened(false);
      setPackageId(null);
      setAmount('');
      router.refresh();
    } catch {
      setFormError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function markDistributed(row: ProfitRow) {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/profit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'distribute', id: row.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(json.error || 'Gagal menandai distribusi');
        return;
      }
      setSelected(null);
      router.refresh();
    } catch {
      setActionError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setActionLoading(false);
    }
  }

  const hasData = metrics.totalBaris > 0;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <MetricCard
          icon={<IconCash size={20} color="var(--mantine-color-blue-6)" />}
          label={`Didistribusikan periode ${metrics.period}`}
          value={formatRupiah(metrics.didistribusikan)}
        />
        <MetricCard
          icon={<IconWallet size={20} color="var(--mantine-color-teal-6)" />}
          label="Bagian investor periode ini"
          value={formatRupiah(metrics.bagianInvestor)}
        />
        <MetricCard
          icon={<IconClock size={20} color="var(--mantine-color-orange-6)" />}
          label="Menunggu distribusi"
          value={formatRupiah(metrics.menunggu)}
        />
      </SimpleGrid>

      {!hasData && (
        <Text size="sm" c="dimmed">
          Belum ada distribusi profit yang tercatat. Periode aktif:{' '}
          {metrics.period}.
        </Text>
      )}

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={600}>Riwayat distribusi</Text>
          <Text size="xs" c="dimmed">
            {hasData
              ? `${metrics.totalBaris} baris terakhir (maksimal 200).`
              : 'Belum ada data untuk ditampilkan.'}
          </Text>
        </div>
        <Button
          leftSection={<IconPlus size={18} />}
          onClick={() => setOpened(true)}
          h={44}
        >
          Distribusikan Profit
        </Button>
      </Group>

      {notice && (
        <Alert color="green" variant="light" onClose={() => setNotice(null)} title="Berhasil">
          {notice}
        </Alert>
      )}
      {actionError && (
        <Alert color="red" variant="light" title="Gagal">
          {actionError}
        </Alert>
      )}

      <ChartCard title="Distribusi profit per periode">
        {chartData.length === 0 ? (
          <EmptyState
            title="Belum ada data grafik"
            description="Grafik muncul setelah minimal satu distribusi profit dicatat."
          />
        ) : (
          <ScrollArea type="auto">
            <div style={{ minWidth: 320 }}>
              <BarChart
                h={260}
                data={chartData}
                dataKey="period"
                series={[
                  { name: 'total', label: 'Nilai kotor', color: 'blue' },
                  { name: 'investor', label: 'Bagian investor', color: 'teal' },
                ]}
                withTooltip
              />
            </div>
          </ScrollArea>
        )}
      </ChartCard>

      <DataTable<ProfitRow>
        data={paged}
        columns={COLUMNS}
        total={filtered.length}
        page={safePage}
        pageSize={pageSize}
        onSearchChange={setSearch}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onRowClick={(row) => {
          setActionError(null);
          setSelected(row);
        }}
      />

      <BaseModal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Distribusikan Profit"
      >
        <Stack gap="md">
          {formError && (
            <Alert color="red" variant="light" title="Gagal menyimpan">
              {formError}
            </Alert>
          )}

          {packagesLoading && (
            <Text size="sm" c="dimmed">
              Memuat daftar paket…
            </Text>
          )}
          {packagesError && (
            <Alert color="red" variant="light">
              {packagesError}
            </Alert>
          )}

          <SearchableSelect
            label="Paket"
            placeholder="Ketik kode atau nama paket"
            data={packages.map((pkg) => ({
              value: pkg.id,
              label: `${pkg.code} · ${pkg.title}`,
            }))}
            value={packageId}
            onChange={setPackageId}
            nothingFoundMessage="Paket tidak ditemukan"
            disabled={packagesLoading}
            required
          />

          <NumberInput
            label="Nominal profit kotor (Rp)"
            placeholder="Contoh: 1000000"
            value={amount}
            onChange={setAmount}
            min={0}
            step={1000}
            required
            styles={{ input: { minHeight: 44 } }}
          />

          <Select
            label="Sumber profit"
            data={SOURCE_OPTIONS}
            value={source}
            onChange={(value) => setSource(value ?? 'OFFSPRING')}
            styles={{ input: { minHeight: 44 } }}
            comboboxProps={{ keepMounted: false }}
          />

          <Paper withBorder p="sm" bg="gray.0">
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="sm">Bagian Raia ({shares.raiaPercent}%)</Text>
                <Text size="sm" fw={600}>
                  {formatRupiah(split?.raia ?? 0)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">
                  Bagian investor ({shares.investorPercent}%)
                </Text>
                <Text size="sm" fw={600}>
                  {formatRupiah(split?.investor ?? 0)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Total
                </Text>
                <Text size="sm" c="dimmed">
                  {formatRupiah(amountNumber)}
                </Text>
              </Group>
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setOpened(false)}
              h={44}
            >
              Batal
            </Button>
            <Button onClick={submit} loading={submitting} h={44}>
              Simpan
            </Button>
          </Group>
        </Stack>
      </BaseModal>

      <BaseModal
        opened={selected !== null}
        onClose={() => setSelected(null)}
        title="Detail distribusi"
      >
        {selected && (
          <Stack gap="xs">
            <Text size="sm">
              <b>Periode:</b> {selected.periode}
            </Text>
            <Text size="sm">
              <b>Paket:</b> {selected.paket}
            </Text>
            <Text size="sm">
              <b>Sumber:</b> {selected.sumber}
            </Text>
            <Text size="sm">
              <b>Nilai kotor:</b> {selected.nilaiKotor}
            </Text>
            <Text size="sm">
              <b>Bagian Raia:</b> {selected.bagianRaia}
            </Text>
            <Text size="sm">
              <b>Bagian investor:</b> {selected.bagianInvestor}
            </Text>
            <Text size="sm">
              <b>Status:</b> {selected.statusLabel}
            </Text>
            <Text size="sm">
              <b>Dicatat:</b> {selected.dibuat}
            </Text>
            <Text size="sm">
              <b>Catatan:</b> {selected.catatan}
            </Text>

            {actionError && (
              <Alert color="red" variant="light">
                {actionError}
              </Alert>
            )}

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                onClick={() => setSelected(null)}
                h={44}
              >
                Tutup
              </Button>
              {selected.status === 'PENDING' && (
                <Button
                  onClick={() => markDistributed(selected)}
                  loading={actionLoading}
                  h={44}
                >
                  Tandai Sudah Dibagikan
                </Button>
              )}
            </Group>
          </Stack>
        )}
      </BaseModal>
    </Stack>
  );
}