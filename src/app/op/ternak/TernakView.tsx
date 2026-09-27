'use client';

import { BarChart, PieChart } from '@mantine/charts';
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
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCloudUpload,
  IconDownload,
  IconMilk,
  IconPaw,
  IconPlus,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { BaseModal } from '@/components/ui/BaseModal';
import { ChartCard } from '@/components/ui/ChartCard';
import { DataTable, DataTableColumn, DataTableFilter } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  Row,
  RowError,
  ValidLivestockRow,
  buildTemplateCsv,
  parseCsv,
  validateRows,
} from '@/lib/import-livestock';

export interface LivestockItem extends Record<string, unknown> {
  id: string;
  tagNumber: string;
  name: string | null;
  sex: string;
  breed: string | null;
  weightKg: number | null;
  status: string;
  packageCode: string;
  animalType: string;
  siteName: string;
}

export interface ChartDatum {
  label: string;
  value: number;
}

export interface TernakInitial {
  total: number;
  items: LivestockItem[];
  aggregates: {
    byAnimalType: ChartDatum[];
    bySite: ChartDatum[];
  };
}

const API_URL = '/api/admin/livestock';

const columns: DataTableColumn<LivestockItem>[] = [
  { accessorKey: 'tagNumber', header: 'Tag' },
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'animalType', header: 'Jenis' },
  { accessorKey: 'sex', header: 'Kelamin' },
  { accessorKey: 'breed', header: 'Ras' },
  { accessorKey: 'weightKg', header: 'Bobot (kg)' },
  { accessorKey: 'siteName', header: 'Site' },
  { accessorKey: 'packageCode', header: 'Paket' },
  { accessorKey: 'status', header: 'Status' },
];

const filters: DataTableFilter[] = [
  {
    label: 'Jenis',
    value: 'animalType',
    options: [
      { label: 'Kambing', value: 'KAMBING' },
      { label: 'Sapi', value: 'SAPI' },
    ],
  },
];

const EVENT_TYPE_OPTIONS = [
  { label: 'Kelahiran', value: 'BIRTH' },
  { label: 'Perkawinan', value: 'MATING' },
  { label: 'Pemeriksaan kesehatan', value: 'HEALTH_CHECK' },
  { label: 'Perahan susu', value: 'MILK' },
  { label: 'Penjualan', value: 'SALE' },
  { label: 'Kematian', value: 'DEATH' },
  { label: 'Vaksinasi', value: 'VACCINATION' },
  { label: 'Catatan bobot', value: 'WEIGHT_LOG' },
];

interface EventFormValues {
  livestockId: string;
  eventType: string;
  eventDate: string;
  description: string;
  quantity: number | null;
}

interface MilkFormValues {
  livestockId: string;
  logDate: string;
  morningLt: number | null;
  eveningLt: number | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TernakView({ initial }: { initial: TernakInitial }) {
  const [items, setItems] = useState<LivestockItem[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [aggregates, setAggregates] = useState(initial.aggregates);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [animalType, setAnimalType] = useState('');
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('q', search);
      if (animalType) params.set('animalType', animalType);

      const res = await fetch(`${API_URL}?${params.toString()}`);
      if (!res.ok) throw new Error('bad-status');
      const json = await res.json();
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
      setAggregates(json.aggregates ?? initial.aggregates);
    } catch {
      setListError('Tidak dapat memuat data ternak. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, animalType, initial.aggregates]);

  useEffect(() => {
    load();
  }, [load]);

  const totalAktif = aggregates.byAnimalType.reduce((sum, d) => sum + d.value, 0);
  const kambingCount =
    aggregates.byAnimalType.find((d) => d.label === 'KAMBING')?.value ?? 0;
  const sapiCount =
    aggregates.byAnimalType.find((d) => d.label === 'SAPI')?.value ?? 0;

  const pieData = aggregates.byAnimalType.map((d) => ({
    name: d.label,
    value: d.value,
    color: d.label === 'SAPI' ? 'orange' : 'blue',
  }));
  const barData = aggregates.bySite.map((d) => ({
    site: d.label,
    jumlah: d.value,
  }));

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((key: string, value: string) => {
    if (key === 'animalType') {
      setAnimalType(value);
      setPage(1);
    }
  }, []);

  const resetFilters = () => {
    setSearch('');
    setAnimalType('');
    setPage(1);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob(['\ufeff' + buildTemplateCsv()], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'template-ternak.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  // ---------- Impor CSV ----------
  const [importOpened, setImportOpened] = useState(false);
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<Row[]>([]);
  const [preview, setPreview] = useState<{
    valid: ValidLivestockRow[];
    errors: RowError[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<{
    imported: number;
    errors: RowError[];
  } | null>(null);

  const resetImport = () => {
    setFileName('');
    setPreviewRows([]);
    setPreview(null);
    setImportError(null);
    setImportReport(null);
    setImporting(false);
  };

  const closeImport = () => {
    setImportOpened(false);
    resetImport();
  };

  const handleFiles = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Gunakan file dengan ekstensi .csv.');
      return;
    }
    setImportError(null);
    setImportReport(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setPreview(null);
        setImportError('File tidak memiliki baris data atau header tidak terbaca.');
        return;
      }
      setPreviewRows(rows);
      setPreview(validateRows(rows, []));
    };
    reader.onerror = () => {
      setImportError('File tidak dapat dibaca.');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || preview.valid.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', rows: previewRows }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setImportError(json?.error || 'Gagal mengimpor data.');
        return;
      }
      setImportReport({ imported: json.imported ?? 0, errors: json.errors ?? [] });
      if ((json.imported ?? 0) > 0) {
        setPreview(null);
        setPreviewRows([]);
        setFileName('');
        load();
      }
    } catch {
      setImportError('Tidak dapat menghubungi server. Impor dibatalkan.');
    } finally {
      setImporting(false);
    }
  };

  // ---------- Pilihan ternak untuk modal event / susu ----------
  const [livestockOptions, setLivestockOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [eventOpened, setEventOpened] = useState(false);
  const [milkOpened, setMilkOpened] = useState(false);

  useEffect(() => {
    if (!eventOpened && !milkOpened) return;
    if (optionsLoading || livestockOptions.length > 0) return;
    let cancelled = false;
    setOptionsLoading(true);
    fetch(`${API_URL}?pageSize=100`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('bad-status'))))
      .then((json) => {
        if (cancelled) return;
        setLivestockOptions(
          (json.items ?? []).map(
            (item: { id: string; tagNumber: string; name: string | null }) => ({
              label: `${item.tagNumber}${item.name ? ` — ${item.name}` : ''}`,
              value: item.id,
            })
          )
        );
      })
      .catch(() => {
        if (!cancelled) setOptionsError('Gagal memuat daftar ternak.');
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventOpened, milkOpened, optionsLoading, livestockOptions.length]);

  // ---------- Form event ----------
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventBusy, setEventBusy] = useState(false);
  const eventForm = useForm<EventFormValues>({
    defaultValues: {
      livestockId: '',
      eventType: '',
      eventDate: today(),
      description: '',
      quantity: null,
    },
  });

  const submitEvent = eventForm.handleSubmit(async (values) => {
    setEventBusy(true);
    setEventError(null);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'event',
          livestockId: values.livestockId,
          eventType: values.eventType,
          eventDate: values.eventDate,
          description: values.description,
          quantity: values.quantity ?? undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setEventError(json?.error || 'Gagal menyimpan event.');
        return;
      }
      setEventOpened(false);
      eventForm.reset({
        livestockId: '',
        eventType: '',
        eventDate: today(),
        description: '',
        quantity: null,
      });
      setNotice('Event ternak berhasil disimpan.');
      load();
    } catch {
      setEventError('Tidak dapat menghubungi server.');
    } finally {
      setEventBusy(false);
    }
  });

  // ---------- Form catatan susu ----------
  const [milkError, setMilkError] = useState<string | null>(null);
  const [milkBusy, setMilkBusy] = useState(false);
  const milkForm = useForm<MilkFormValues>({
    defaultValues: {
      livestockId: '',
      logDate: today(),
      morningLt: null,
      eveningLt: null,
    },
  });

  const submitMilk = milkForm.handleSubmit(async (values) => {
    setMilkBusy(true);
    setMilkError(null);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'milk',
          livestockId: values.livestockId,
          logDate: values.logDate,
          morningLt: values.morningLt ?? undefined,
          eveningLt: values.eveningLt ?? undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setMilkError(json?.error || 'Gagal menyimpan catatan susu.');
        return;
      }
      setMilkOpened(false);
      milkForm.reset({
        livestockId: '',
        logDate: today(),
        morningLt: null,
        eveningLt: null,
      });
      setNotice('Catatan susu berhasil disimpan.');
    } catch {
      setMilkError('Tidak dapat menghubungi server.');
    } finally {
      setMilkBusy(false);
    }
  });

  const openEvent = () => {
    setEventError(null);
    setEventOpened(true);
  };

  const openMilk = () => {
    setMilkError(null);
    setMilkOpened(true);
  };

  return (
    <Stack gap="md">
      {notice && (
        <Alert
          color="green"
          icon={<IconCircleCheck size={16} />}
          withCloseButton
          onClose={() => setNotice(null)}
        >
          {notice}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <MetricCard
          icon={<IconPaw size={18} color="var(--mantine-color-blue-6)" />}
          label="Total Ternak"
          value={String(total)}
        />
        <MetricCard
          icon={<IconCircleCheck size={18} color="var(--mantine-color-green-6)" />}
          label="Ternak Aktif"
          value={String(totalAktif)}
        />
        <MetricCard
          icon={<IconPaw size={18} color="var(--mantine-color-blue-6)" />}
          label="Kambing"
          value={String(kambingCount)}
        />
        <MetricCard
          icon={<IconPaw size={18} color="var(--mantine-color-orange-6)" />}
          label="Sapi"
          value={String(sapiCount)}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ChartCard title="Ternak per jenis">
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              withLabelsLine
              labelsPosition="outside"
              labelsType="percent"
              withTooltip
              tooltipDataSource="segment"
              mx="auto"
              size={200}
            />
          ) : (
            <EmptyState
              title="Belum ada data"
              description="Belum ada ternak aktif untuk ditampilkan."
            />
          )}
        </ChartCard>
        <ChartCard title="Ternak per site proyek">
          {barData.length > 0 ? (
            <BarChart
              data={barData}
              dataKey="site"
              series={[{ name: 'jumlah', color: 'teal' }]}
              withTooltip
              h={240}
              xAxisLabel="Site"
              yAxisLabel="Jumlah"
            />
          ) : (
            <EmptyState
              title="Belum ada data"
              description="Belum ada ternak aktif untuk ditampilkan."
            />
          )}
        </ChartCard>
      </SimpleGrid>

      <Group gap="sm" grow={false}>
        <Button
          leftSection={<IconDownload size={16} />}
          variant="default"
          onClick={handleDownloadTemplate}
          styles={{ root: { minHeight: 44 } }}
        >
          Unduh Template
        </Button>
        <Button
          leftSection={<IconCloudUpload size={16} />}
          onClick={() => {
            resetImport();
            setImportOpened(true);
          }}
          styles={{ root: { minHeight: 44 } }}
        >
          Impor CSV
        </Button>
        <Button
          leftSection={<IconPlus size={16} />}
          variant="light"
          onClick={openEvent}
          styles={{ root: { minHeight: 44 } }}
        >
          Tambah Event
        </Button>
        <Button
          leftSection={<IconMilk size={16} />}
          variant="light"
          onClick={openMilk}
          styles={{ root: { minHeight: 44 } }}
        >
          Tambah Catatan Susu
        </Button>
      </Group>

      {listError ? (
        <ErrorState
          title="Gagal memuat data"
          description={listError}
          onRetry={load}
        />
      ) : !loading && items.length === 0 ? (
        <Stack gap="md">
          <TextInput
            placeholder="Cari tag atau nama"
            aria-label="Cari tag atau nama"
            value={search}
            onChange={(e) => handleSearch(e.currentTarget.value)}
            styles={{ input: { minHeight: 44 } }}
          />
          <EmptyState
            title="Tidak ada data ternak"
            description={
              search || animalType
                ? 'Tidak ada ternak yang cocok dengan pencarian atau filter.'
                : 'Belum ada data ternak. Impor CSV untuk menambah data.'
            }
            action={
              search || animalType
                ? { label: 'Reset pencarian', onClick: resetFilters }
                : undefined
            }
          />
        </Stack>
      ) : (
        <DataTable<LivestockItem>
          data={items}
          columns={columns}
          filters={filters}
          total={total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          onSearchChange={handleSearch}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onFilterChange={handleFilterChange}
        />
      )}

      {/* Modal impor CSV */}
      <BaseModal
        opened={importOpened}
        onClose={closeImport}
        title="Impor CSV Ternak"
        size="lg"
      >
        <Stack gap="md">
          {importError && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {importError}
            </Alert>
          )}

          {importReport && (
            <Alert
              color={importReport.errors.length > 0 ? 'yellow' : 'green'}
              icon={
                importReport.errors.length > 0 ? (
                  <IconAlertCircle size={16} />
                ) : (
                  <IconCircleCheck size={16} />
                )
              }
            >
              <Text fw={600}>
                Impor selesai: {importReport.imported} baris tersimpan.
              </Text>
              {importReport.errors.length > 0 && (
                <Text size="sm">
                  {importReport.errors.length} baris tidak diimpor.{' '}
                  {importReport.errors
                    .slice(0, 5)
                    .map((e) => `Baris ${e.row}: ${e.message}`)
                    .join(' | ')}
                </Text>
              )}
            </Alert>
          )}

          {!preview && (
            <Dropzone
              onDrop={handleFiles}
              onReject={() =>
                setImportError('File ditolak. Gunakan file .csv yang valid.')
              }
              radius="md"
              styles={{ root: { minHeight: 140 } }}
            >
              <Group justify="center" gap="md" style={{ minHeight: 100 }}>
                <IconCloudUpload
                  size={40}
                  stroke={1.5}
                  color="var(--mantine-color-dimmed)"
                />
                <div>
                  <Text size="sm" inline>
                    Letakkan file CSV di sini atau klik untuk memilih file
                  </Text>
                  <Text size="xs" c="dimmed">
                    Maksimal 1000 baris per impor
                  </Text>
                </div>
              </Group>
            </Dropzone>
          )}

          {preview && (
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm">File: {fileName}</Text>
                <Text size="sm">
                  {previewRows.length} baris terbaca — {preview.valid.length} valid,{' '}
                  {preview.errors.length} error
                </Text>
              </Group>

              {preview.errors.length > 0 && (
                <Paper withBorder>
                  <ScrollArea>
                    <Table>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Baris</Table.Th>
                          <Table.Th>Kolom</Table.Th>
                          <Table.Th>Pesan</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {preview.errors.slice(0, 50).map((error, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{error.row > 0 ? error.row : '-'}</Table.Td>
                            <Table.Td>{error.column}</Table.Td>
                            <Table.Td>{error.message}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Paper>
              )}
              {preview.errors.length > 50 && (
                <Text size="xs" c="dimmed">
                  Menampilkan 50 dari {preview.errors.length} error.
                </Text>
              )}

              {preview.valid.length > 0 && (
                <Text size="sm" c="dimmed">
                  {preview.valid.length} baris valid siap diimpor, contoh:{' '}
                  {preview.valid
                    .slice(0, 3)
                    .map((v) => v.tagNumber)
                    .join(', ')}
                  {preview.valid.length > 3 ? ', …' : ''}
                </Text>
              )}

              <Group justify="flex-end">
                <Button
                  variant="default"
                  onClick={resetImport}
                  styles={{ root: { minHeight: 44 } }}
                >
                  Ganti File
                </Button>
                <Button
                  onClick={handleImport}
                  loading={importing}
                  disabled={preview.valid.length === 0}
                  styles={{ root: { minHeight: 44 } }}
                >
                  Impor {preview.valid.length} baris valid
                </Button>
              </Group>
            </Stack>
          )}

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={closeImport}
              styles={{ root: { minHeight: 44 } }}
            >
              Tutup
            </Button>
          </Group>
        </Stack>
      </BaseModal>

      {/* Modal tambah event */}
      <BaseModal
        opened={eventOpened}
        onClose={() => setEventOpened(false)}
        title="Tambah Event Ternak"
      >
        <form onSubmit={submitEvent} noValidate>
          <Stack gap="md">
            {eventError && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {eventError}
              </Alert>
            )}

            <Controller
              control={eventForm.control}
              name="livestockId"
              rules={{ required: 'Ternak wajib dipilih.' }}
              render={({ field, fieldState }) => (
                <Select
                  label="Ternak"
                  placeholder="Pilih ternak"
                  data={livestockOptions}
                  searchable
                  nothingFoundMessage={
                    optionsLoading ? 'Memuat...' : 'Ternak tidak ditemukan'
                  }
                  value={field.value || null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  styles={{ input: { minHeight: 44 } }}
                  comboboxProps={{ keepMounted: false }}
                />
              )}
            />

            <Controller
              control={eventForm.control}
              name="eventType"
              rules={{ required: 'Jenis event wajib dipilih.' }}
              render={({ field, fieldState }) => (
                <Select
                  label="Jenis event"
                  placeholder="Pilih jenis event"
                  data={EVENT_TYPE_OPTIONS}
                  value={field.value || null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  styles={{ input: { minHeight: 44 } }}
                  comboboxProps={{ keepMounted: false }}
                />
              )}
            />

            <TextInput
              type="date"
              label="Tanggal event"
              {...eventForm.register('eventDate', {
                required: 'Tanggal event wajib diisi.',
              })}
              error={eventForm.formState.errors.eventDate?.message}
              styles={{ input: { minHeight: 44 } }}
            />

            <TextInput
              label="Keterangan (opsional)"
              placeholder="Misal: vaksin rutin kandang utara"
              {...eventForm.register('description')}
              styles={{ input: { minHeight: 44 } }}
            />

            <Controller
              control={eventForm.control}
              name="quantity"
              render={({ field }) => (
                <NumberInput
                  label="Kuantitas (opsional)"
                  placeholder="Misal: 1"
                  min={0}
                  value={field.value ?? undefined}
                  onChange={(value) =>
                    field.onChange(value === '' ? null : Number(value))
                  }
                  onBlur={field.onBlur}
                  styles={{ input: { minHeight: 44 } }}
                />
              )}
            />

            <Group justify="flex-end">
              <Button
                variant="default"
                type="button"
                onClick={() => setEventOpened(false)}
                styles={{ root: { minHeight: 44 } }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                loading={eventBusy}
                styles={{ root: { minHeight: 44 } }}
              >
                Simpan Event
              </Button>
            </Group>
          </Stack>
        </form>
      </BaseModal>

      {/* Modal catatan susu */}
      <BaseModal
        opened={milkOpened}
        onClose={() => setMilkOpened(false)}
        title="Tambah Catatan Susu"
      >
        <form onSubmit={submitMilk} noValidate>
          <Stack gap="md">
            {milkError && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {milkError}
              </Alert>
            )}

            <Controller
              control={milkForm.control}
              name="livestockId"
              rules={{ required: 'Ternak wajib dipilih.' }}
              render={({ field, fieldState }) => (
                <Select
                  label="Ternak"
                  placeholder="Pilih ternak"
                  data={livestockOptions}
                  searchable
                  nothingFoundMessage={
                    optionsLoading ? 'Memuat...' : 'Ternak tidak ditemukan'
                  }
                  value={field.value || null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  styles={{ input: { minHeight: 44 } }}
                  comboboxProps={{ keepMounted: false }}
                />
              )}
            />

            <TextInput
              type="date"
              label="Tanggal catatan"
              {...milkForm.register('logDate', {
                required: 'Tanggal catatan wajib diisi.',
              })}
              error={milkForm.formState.errors.logDate?.message}
              styles={{ input: { minHeight: 44 } }}
            />

            <Controller
              control={milkForm.control}
              name="morningLt"
              render={({ field }) => (
                <NumberInput
                  label="Susu pagi (liter)"
                  placeholder="Misal: 1.5"
                  min={0}
                  decimalScale={2}
                  value={field.value ?? undefined}
                  onChange={(value) =>
                    field.onChange(value === '' ? null : Number(value))
                  }
                  onBlur={field.onBlur}
                  styles={{ input: { minHeight: 44 } }}
                />
              )}
            />

            <Controller
              control={milkForm.control}
              name="eveningLt"
              render={({ field }) => (
                <NumberInput
                  label="Susu sore (liter)"
                  placeholder="Misal: 1.2"
                  min={0}
                  decimalScale={2}
                  value={field.value ?? undefined}
                  onChange={(value) =>
                    field.onChange(value === '' ? null : Number(value))
                  }
                  onBlur={field.onBlur}
                  styles={{ input: { minHeight: 44 } }}
                />
              )}
            />

            <Text size="xs" c="dimmed">
              Isi minimal salah satu volume susu.
            </Text>

            <Group justify="flex-end">
              <Button
                variant="default"
                type="button"
                onClick={() => setMilkOpened(false)}
                styles={{ root: { minHeight: 44 } }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                loading={milkBusy}
                styles={{ root: { minHeight: 44 } }}
              >
                Simpan Catatan
              </Button>
            </Group>
          </Stack>
        </form>
      </BaseModal>
    </Stack>
  );
}
