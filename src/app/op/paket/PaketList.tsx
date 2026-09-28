'use client';

import {
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconPlus, IconTrash } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { StatusBadge } from '@/components/ui/StatusBadge';

export interface PaketRow {
  id: string;
  code: string;
  title: string;
  animalType: string;
  status: string;
  price: number;
  lotPrice: number;
  totalLots: number;
  soldLots: number;
  periodMonths: number;
  maxInvestors: number;
  coverImage?: string | null;
  description?: string | null;
  estimatedRoi?: number | null;
  estimatedOffspring?: number | null;
  estimatedOffspringPrice?: number | null;
  estimatedMilkMonthly?: number | null;
  estimatedMilkPrice?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: Date | string;
  siteProject: { id: string; name: string };
}

export interface SiteOption {
  id: string;
  name: string;
}

interface PaketListProps {
  rows: PaketRow[];
  sites: SiteOption[];
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'DRAFT' },
  { value: 'OPEN', label: 'OPEN' },
  { value: 'RUNNING', label: 'RUNNING' },
  { value: 'CLOSED', label: 'CLOSED' },
  { value: 'SOLD_OUT', label: 'SOLD_OUT' },
];

const ANIMAL_OPTIONS = [
  { value: 'KAMBING', label: 'Kambing' },
  { value: 'SAPI', label: 'Sapi' },
];

const COST_TYPE_OPTIONS = [
  { value: 'ANIMAL', label: 'Ternak' },
  { value: 'TAAWUN', label: "Ta'awun" },
  { value: 'RENT', label: 'Sewa kandang' },
  { value: 'FEED', label: 'Pakan' },
  { value: 'LABOR', label: 'Tenaga kerja' },
  { value: 'MEDICINE', label: 'Obat' },
  { value: 'OPERATIONAL', label: 'Operasional' },
];

interface CostRow {
  costType: string;
  amount: string;
  description: string;
}

interface FormState {
  code: string;
  title: string;
  siteProjectId: string;
  status: string;
  description: string;
  animalType: string;
  periodMonths: string;
  maxInvestors: string;
  price: string;
  lotPrice: string;
  estimatedRoi: string;
  estimatedOffspring: string;
  estimatedOffspringPrice: string;
  estimatedMilkMonthly: string;
  estimatedMilkPrice: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  costs: CostRow[];
}

type FormErrors = Partial<Record<keyof Omit<FormState, 'costs'> | 'costs', string>>;

const EMPTY_FORM: FormState = {
  code: '',
  title: '',
  siteProjectId: '',
  status: 'DRAFT',
  description: '',
  animalType: 'KAMBING',
  periodMonths: '12',
  maxInvestors: '100',
  price: '',
  lotPrice: '',
  estimatedRoi: '',
  estimatedOffspring: '',
  estimatedOffspringPrice: '',
  estimatedMilkMonthly: '',
  estimatedMilkPrice: '',
  coverImage: '',
  startDate: '',
  endDate: '',
  costs: [{ costType: 'ANIMAL', amount: '', description: '' }],
};

function toForm(row?: PaketRow): FormState {
  if (!row) return { ...EMPTY_FORM, costs: [{ costType: 'ANIMAL', amount: '', description: '' }] };
  return {
    code: row.code ?? '',
    title: row.title ?? '',
    siteProjectId: row.siteProject?.id ?? '',
    status: row.status ?? 'DRAFT',
    description: row.description ?? '',
    animalType: row.animalType ?? 'KAMBING',
    periodMonths: row.periodMonths != null ? String(row.periodMonths) : '12',
    maxInvestors: row.maxInvestors != null ? String(row.maxInvestors) : '100',
    price: row.price != null ? String(row.price) : '',
    lotPrice: row.lotPrice != null ? String(row.lotPrice) : '',
    estimatedRoi: row.estimatedRoi != null ? String(row.estimatedRoi) : '',
    estimatedOffspring: row.estimatedOffspring != null ? String(row.estimatedOffspring) : '',
    estimatedOffspringPrice:
      row.estimatedOffspringPrice != null ? String(row.estimatedOffspringPrice) : '',
    estimatedMilkMonthly: row.estimatedMilkMonthly != null ? String(row.estimatedMilkMonthly) : '',
    estimatedMilkPrice: row.estimatedMilkPrice != null ? String(row.estimatedMilkPrice) : '',
    coverImage: row.coverImage ?? '',
    startDate: row.startDate ? String(row.startDate).slice(0, 10) : '',
    endDate: row.endDate ? String(row.endDate).slice(0, 10) : '',
    costs: [{ costType: 'ANIMAL', amount: '', description: '' }],
  };
}

function calcTotalLots(form: FormState): number {
  const price = Number(form.price);
  const lotPrice = Number(form.lotPrice);
  if (!price || !lotPrice || price <= 0 || lotPrice <= 0) return 0;
  return Math.floor(price / lotPrice);
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.code.trim().length < 2) errors.code = 'Kode paket wajib diisi.';
  if (form.title.trim().length < 3) errors.title = 'Judul paket minimal 3 karakter.';
  if (!form.siteProjectId) errors.siteProjectId = 'Site project wajib dipilih.';

  const price = Number(form.price);
  if (!form.price.trim() || Number.isNaN(price) || price < 10000) {
    errors.price = 'Harga paket minimal Rp10.000.';
  }
  const lotPrice = Number(form.lotPrice);
  if (!form.lotPrice.trim() || Number.isNaN(lotPrice) || lotPrice < 1000) {
    errors.lotPrice = 'Harga per lot minimal Rp1.000.';
  }
  if (!errors.price && !errors.lotPrice && calcTotalLots(form) < 1) {
    errors.price = 'Harga paket harus lebih besar atau sama dengan harga per lot.';
  }

  const period = Number(form.periodMonths);
  if (Number.isNaN(period) || period < 1 || period > 60) {
    errors.periodMonths = 'Periode harus antara 1 sampai 60 bulan.';
  }
  const maxInvestors = Number(form.maxInvestors);
  if (Number.isNaN(maxInvestors) || maxInvestors < 1) {
    errors.maxInvestors = 'Maksimal investor minimal 1.';
  }

  const validCosts = form.costs.filter((c) => c.amount.trim() && Number(c.amount) > 0);
  if (validCosts.length === 0) {
    errors.costs = 'Minimal 1 komponen biaya dengan jumlah lebih dari 0.';
  }

  return errors;
}

function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function PaketList({ rows: initialRows, sites }: PaketListProps) {
  const [rows, setRows] = useState<PaketRow[]>(initialRows);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<PaketRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (!q) return true;
      return [row.code, row.title, row.siteProject?.name, row.animalType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/packages');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.items)) setRows(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(toForm());
    setErrors({});
    setFormError(null);
    setSuccess(null);
    setOpened(true);
  };

  const openEdit = (row: PaketRow) => {
    setEditing(row);
    setForm(toForm(row));
    setErrors({});
    setFormError(null);
    setSuccess(null);
    setOpened(true);
  };

  const close = () => {
    setOpened(false);
    setFormError(null);
    setErrors({});
  };

  const setField = (key: keyof Omit<FormState, 'costs'>, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const setCostField = (index: number, key: keyof CostRow, value: string) => {
    setForm((prev) => ({
      ...prev,
      costs: prev.costs.map((cost, i) => (i === index ? { ...cost, [key]: value } : cost)),
    }));
    setErrors((prev) => (prev.costs ? { ...prev, costs: undefined } : prev));
  };

  const addCostRow = () => {
    setForm((prev) => ({
      ...prev,
      costs: [...prev.costs, { costType: 'FEED', amount: '', description: '' }],
    }));
  };

  const removeCostRow = (index: number) => {
    setForm((prev) => ({ ...prev, costs: prev.costs.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        code: form.code.trim(),
        title: form.title.trim(),
        animalType: form.animalType,
        siteProjectId: form.siteProjectId,
        periodMonths: Number(form.periodMonths),
        price: Number(form.price),
        lotPrice: Number(form.lotPrice),
        totalLots: calcTotalLots(form),
        maxInvestors: Number(form.maxInvestors),
        status: form.status,
        description: form.description.trim() || undefined,
        estimatedRoi: toNumber(form.estimatedRoi),
        estimatedOffspring: toNumber(form.estimatedOffspring),
        estimatedOffspringPrice: toNumber(form.estimatedOffspringPrice),
        estimatedMilkMonthly: toNumber(form.estimatedMilkMonthly),
        estimatedMilkPrice: toNumber(form.estimatedMilkPrice),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        costs: form.costs
          .filter((c) => c.amount.trim() && Number(c.amount) > 0)
          .map((c) => ({
            costType: c.costType,
            amount: Number(c.amount),
            description: c.description.trim() || undefined,
          })),
      };

      const res = await fetch(
        editing ? `/api/admin/packages?id=${encodeURIComponent(editing.id)}` : '/api/admin/packages',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, string>));
        setFormError(data?.error || 'Gagal menyimpan paket. Periksa kembali isian Anda.');
        return;
      }

      setSuccess('Paket berhasil disimpan.');
      setOpened(false);
      await refresh();
    } catch {
      setFormError('Tidak dapat terhubung ke server. Coba lagi nanti.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm('Hapus paket ini?')) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/admin/packages?id=${encodeURIComponent(editing.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, string>));
        setFormError(data?.error || 'Gagal menghapus paket.');
        return;
      }
      setSuccess('Paket berhasil dihapus.');
      setOpened(false);
      await refresh();
    } catch {
      setFormError('Tidak dapat terhubung ke server. Coba lagi nanti.');
    } finally {
      setSubmitting(false);
    }
  };

  type RowView = PaketRow & { siteLabel: string; terjualLabel: string; aksi: string };

  const columns: DataTableColumn<RowView>[] = [
    { accessorKey: 'code', header: 'Kode', sortable: true },
    { accessorKey: 'title', header: 'Judul', sortable: true },
    { accessorKey: 'siteLabel', header: 'Site' },
    { accessorKey: 'price', header: 'Harga', sortable: true },
    { accessorKey: 'lotPrice', header: 'Lot' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'terjualLabel', header: 'Terjual' },
    { accessorKey: 'aksi', header: 'Aksi' },
  ];

  const data: RowView[] = paged.map((row) => ({
    ...row,
    siteLabel: row.siteProject?.name ?? '-',
    terjualLabel: `${row.soldLots}/${row.totalLots}`,
    aksi: 'Klik baris untuk ubah',
  }));

  const inputStyles = { input: { minHeight: 44 } };
  const totalLots = calcTotalLots(form);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Paket Investasi</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
            Kelola paket ternak: info, ternak, biaya, return, media, dan jadwal.
          </p>
        </div>
        <Button onClick={openCreate} styles={{ root: { minHeight: 44 } }}>
          Tambah Paket
        </Button>
      </Group>

      {success && (
        <Alert
          color="green"
          icon={<IconCheck size={16} />}
          onClose={() => setSuccess(null)}
          withCloseButton
        >
          {success}
        </Alert>
      )}

      <DataTable<Record<string, unknown>>
        data={data as unknown as Array<Record<string, unknown>>}
        columns={columns as unknown as Array<DataTableColumn<Record<string, unknown>>>}
        filters={[
          {
            label: 'Status',
            value: 'status',
            options: STATUS_OPTIONS,
          },
        ]}
        total={filtered.length}
        page={safePage}
        pageSize={pageSize}
        loading={loading}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onFilterChange={(key, value) => {
          if (key === 'status') {
            setStatus(value);
            setPage(1);
          }
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onRowClick={(row) => {
          const original = rows.find((r) => r.id === row.id);
          if (original) openEdit(original);
        }}
      />

      <BaseModal
        opened={opened}
        onClose={close}
        size="lg"
        title={
          <Group gap="xs">
            <span>{editing ? 'Edit Paket' : 'Tambah Paket'}</span>
            {editing && <StatusBadge status={editing.status} />}
          </Group>
        }
      >
        <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
          <Stack gap="sm">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {formError}
              </Alert>
            )}

            <Tabs defaultValue="info" keepMounted={false}>
              <Tabs.List>
                <Tabs.Tab value="info">Info</Tabs.Tab>
                <Tabs.Tab value="ternak">Ternak</Tabs.Tab>
                <Tabs.Tab value="biaya">Biaya</Tabs.Tab>
                <Tabs.Tab value="return">Return</Tabs.Tab>
                <Tabs.Tab value="media">Media</Tabs.Tab>
                <Tabs.Tab value="jadwal">Jadwal</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="info" pt="sm">
                <Stack gap="sm">
                  <TextInput
                    label="Kode paket"
                    placeholder="cth. PCK-001"
                    value={form.code}
                    onChange={(e) => setField('code', e.currentTarget.value)}
                    error={errors.code}
                    styles={inputStyles}
                  />
                  <TextInput
                    label="Judul paket"
                    placeholder="cth. Paket Kambing Etawa Sleman"
                    value={form.title}
                    onChange={(e) => setField('title', e.currentTarget.value)}
                    error={errors.title}
                    styles={inputStyles}
                  />
                  <SearchableSelect
                    label="Site project"
                    placeholder="Pilih site project"
                    data={sites.map((s) => ({ value: s.id, label: s.name }))}
                    value={form.siteProjectId}
                    onChange={(value) => setField('siteProjectId', value ?? '')}
                    error={errors.siteProjectId}
                  />
                  <Select
                    label="Status paket"
                    data={STATUS_OPTIONS}
                    value={form.status}
                    onChange={(value) => setField('status', value ?? 'DRAFT')}
                    styles={inputStyles}
                    comboboxProps={{ keepMounted: false }}
                  />
                  <Textarea
                    label="Deskripsi"
                    value={form.description}
                    onChange={(e) => setField('description', e.currentTarget.value)}
                    autosize
                    minRows={2}
                    styles={inputStyles}
                  />
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="ternak" pt="sm">
                <Stack gap="sm">
                  <Select
                    label="Jenis ternak"
                    data={ANIMAL_OPTIONS}
                    value={form.animalType}
                    onChange={(value) => setField('animalType', value ?? 'KAMBING')}
                    styles={inputStyles}
                    comboboxProps={{ keepMounted: false }}
                  />
                  <NumberInput
                    label="Periode (bulan)"
                    value={form.periodMonths}
                    onChange={(value) => setField('periodMonths', String(value ?? ''))}
                    error={errors.periodMonths}
                    min={1}
                    max={60}
                    allowDecimal={false}
                    styles={inputStyles}
                  />
                  <NumberInput
                    label="Maksimal investor"
                    value={form.maxInvestors}
                    onChange={(value) => setField('maxInvestors', String(value ?? ''))}
                    error={errors.maxInvestors}
                    min={1}
                    allowDecimal={false}
                    styles={inputStyles}
                  />
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="biaya" pt="sm">
                <Stack gap="sm">
                  {errors.costs && (
                    <Alert color="red" icon={<IconAlertCircle size={16} />}>
                      {errors.costs}
                    </Alert>
                  )}
                  {form.costs.map((cost, index) => (
                    <Group key={index} align="flex-end" gap="xs" wrap="wrap">
                      <Select
                        label="Jenis biaya"
                        data={COST_TYPE_OPTIONS}
                        value={cost.costType}
                        onChange={(value) => setCostField(index, 'costType', value ?? 'ANIMAL')}
                        styles={{ ...inputStyles, input: { ...inputStyles.input, minHeight: 44 } }}
                        comboboxProps={{ keepMounted: false }}
                        w={160}
                      />
                      <NumberInput
                        label="Jumlah biaya"
                        value={cost.amount}
                        onChange={(value) => setCostField(index, 'amount', String(value ?? ''))}
                        min={0}
                        allowDecimal={false}
                        w={180}
                        styles={inputStyles}
                      />
                      <TextInput
                        label="Keterangan"
                        value={cost.description}
                        onChange={(e) => setCostField(index, 'description', e.currentTarget.value)}
                        style={{ flex: 1, minWidth: 160 }}
                        styles={inputStyles}
                      />
                      <Button
                        color="red"
                        variant="light"
                        onClick={() => removeCostRow(index)}
                        styles={{ root: { minHeight: 44, width: 44 } }}
                        aria-label={`Hapus biaya ${index + 1}`}
                      >
                        <IconTrash size={16} />
                      </Button>
                    </Group>
                  ))}
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    onClick={addCostRow}
                    styles={{ root: { minHeight: 44 } }}
                  >
                    Tambah komponen biaya
                  </Button>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="return" pt="sm">
                <Stack gap="sm">
                  <NumberInput
                    label="Harga paket"
                    value={form.price}
                    onChange={(value) => setField('price', String(value ?? ''))}
                    error={errors.price}
                    min={0}
                    allowDecimal={false}
                    styles={inputStyles}
                  />
                  <NumberInput
                    label="Harga per lot"
                    value={form.lotPrice}
                    onChange={(value) => setField('lotPrice', String(value ?? ''))}
                    error={errors.lotPrice}
                    min={0}
                    allowDecimal={false}
                    styles={inputStyles}
                  />
                  <Text size="sm" fw={600}>
                    Total lot: {totalLots}
                  </Text>
                  <NumberInput
                    label="Estimasi ROI (%)"
                    value={form.estimatedRoi}
                    onChange={(value) => setField('estimatedRoi', String(value ?? ''))}
                    min={0}
                    max={100}
                    styles={inputStyles}
                  />
                  <Group grow align="flex-start">
                    <NumberInput
                      label="Estimasi anak (ekor)"
                      value={form.estimatedOffspring}
                      onChange={(value) => setField('estimatedOffspring', String(value ?? ''))}
                      min={0}
                      allowDecimal={false}
                      styles={inputStyles}
                    />
                    <NumberInput
                      label="Harga anak (Rp)"
                      value={form.estimatedOffspringPrice}
                      onChange={(value) =>
                        setField('estimatedOffspringPrice', String(value ?? ''))
                      }
                      min={0}
                      allowDecimal={false}
                      styles={inputStyles}
                    />
                  </Group>
                  <Group grow align="flex-start">
                    <NumberInput
                      label="Estimasi susu / bulan (liter)"
                      value={form.estimatedMilkMonthly}
                      onChange={(value) => setField('estimatedMilkMonthly', String(value ?? ''))}
                      min={0}
                      styles={inputStyles}
                    />
                    <NumberInput
                      label="Harga susu (Rp)"
                      value={form.estimatedMilkPrice}
                      onChange={(value) => setField('estimatedMilkPrice', String(value ?? ''))}
                      min={0}
                      allowDecimal={false}
                      styles={inputStyles}
                    />
                  </Group>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="media" pt="sm">
                <Stack gap="sm">
                  <TextInput
                    label="URL cover image"
                    placeholder="https://..."
                    value={form.coverImage}
                    onChange={(e) => setField('coverImage', e.currentTarget.value)}
                    styles={inputStyles}
                  />
                  <Text size="xs" c="dimmed">
                    Unggah gallery menyusul; sementara gunakan URL gambar eksternal.
                  </Text>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="jadwal" pt="sm">
                <Stack gap="sm">
                  <TextInput
                    label="Tanggal mulai"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setField('startDate', e.currentTarget.value)}
                    styles={inputStyles}
                  />
                  <TextInput
                    label="Tanggal selesai"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setField('endDate', e.currentTarget.value)}
                    styles={inputStyles}
                  />
                </Stack>
              </Tabs.Panel>
            </Tabs>

            <Group justify="space-between" mt="xs">
              {editing ? (
                <Button
                  color="red"
                  variant="light"
                  onClick={handleDelete}
                  loading={submitting}
                  styles={{ root: { minHeight: 44 } }}
                >
                  Hapus
                </Button>
              ) : (
                <span />
              )}
              <Group gap="sm">
                <Button variant="default" onClick={close} styles={{ root: { minHeight: 44 } }}>
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  loading={submitting}
                  styles={{ root: { minHeight: 44 } }}
                >
                  Simpan
                </Button>
              </Group>
            </Group>
          </Stack>
        </div>
      </BaseModal>
    </Stack>
  );
}
