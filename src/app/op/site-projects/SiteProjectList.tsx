'use client';

import {
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { StatusBadge } from '@/components/ui/StatusBadge';

export interface SiteProjectRow {
  id: string;
  code: string;
  name: string;
  legalEntity: string;
  legalNumber?: string | null;
  npwp?: string | null;
  address: string;
  province: string;
  city: string;
  village?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  description?: string | null;
  capacity: number;
  status: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

const PROVINCES = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Jambi',
  'Sumatera Selatan',
  'Bengkulu',
  'Lampung',
  'Kepulauan Bangka Belitung',
  'Kepulauan Riau',
  'DKI Jakarta',
  'Jawa Barat',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Banten',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Sulawesi Tengah',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Gorontalo',
  'Sulawesi Barat',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
  'Papua Selatan',
  'Papua Tengah',
  'Papua Pegunungan',
  'Papua Barat Daya',
].map((name) => ({ value: name, label: name }));

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'NONAKTIF', label: 'NONAKTIF' },
];

interface FormState {
  name: string;
  legalEntity: string;
  legalNumber: string;
  npwp: string;
  address: string;
  province: string;
  city: string;
  village: string;
  contactPerson: string;
  contactPhone: string;
  description: string;
  capacity: string;
  status: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: '',
  legalEntity: '',
  legalNumber: '',
  npwp: '',
  address: '',
  province: '',
  city: '',
  village: '',
  contactPerson: '',
  contactPhone: '',
  description: '',
  capacity: '',
  status: 'ACTIVE',
};

function toForm(row?: SiteProjectRow): FormState {
  if (!row) return { ...EMPTY_FORM };
  return {
    name: row.name ?? '',
    legalEntity: row.legalEntity ?? '',
    legalNumber: row.legalNumber ?? '',
    npwp: row.npwp ?? '',
    address: row.address ?? '',
    province: row.province ?? '',
    city: row.city ?? '',
    village: row.village ?? '',
    contactPerson: row.contactPerson ?? '',
    contactPhone: row.contactPhone ?? '',
    description: row.description ?? '',
    capacity: row.capacity != null ? String(row.capacity) : '',
    status: row.status ?? 'ACTIVE',
  };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.name.trim().length < 3) {
    errors.name = 'Nama site minimal 3 karakter.';
  }
  if (form.legalEntity.trim().length < 3) {
    errors.legalEntity = 'Badan usaha minimal 3 karakter.';
  }
  if (form.address.trim().length < 5) {
    errors.address = 'Alamat minimal 5 karakter.';
  }
  if (!form.city.trim()) {
    errors.city = 'Kabupaten/Kota wajib diisi.';
  }
  const capacity = Number(form.capacity);
  if (!form.capacity.trim() || Number.isNaN(capacity) || capacity < 1 || capacity > 10000) {
    errors.capacity = 'Kapasitas harus antara 1 sampai 10000 ekor.';
  }
  if (!form.province.trim()) {
    errors.province = 'Provinsi wajib dipilih.';
  }
  return errors;
}

interface SiteProjectListProps {
  rows: SiteProjectRow[];
}

export function SiteProjectList({ rows: initialRows }: SiteProjectListProps) {
  const [rows, setRows] = useState<SiteProjectRow[]>(initialRows);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<SiteProjectRow | null>(null);
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
      return [row.code, row.name, row.legalEntity, row.city, row.province]
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
      const res = await fetch('/api/admin/site-projects');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.items)) {
          setRows(data.items);
        }
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

  const openEdit = (row: SiteProjectRow) => {
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

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async () => {
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name.trim(),
        legalEntity: form.legalEntity.trim(),
        legalNumber: form.legalNumber.trim() || null,
        npwp: form.npwp.trim() || null,
        address: form.address.trim(),
        province: form.province,
        city: form.city.trim(),
        village: form.village.trim() || '-',
        contactPerson: form.contactPerson.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        description: form.description.trim() || null,
        capacity: Number(form.capacity),
        status: form.status,
      };

      const res = await fetch(
        editing ? `/api/admin/site-projects?id=${encodeURIComponent(editing.id)}` : '/api/admin/site-projects',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, string>));
        setFormError(data?.error || 'Gagal menyimpan site project. Periksa kembali isian Anda.');
        return;
      }

      setSuccess('Site project berhasil disimpan.');
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
    if (!window.confirm('Hapus site project ini?')) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(
        `/api/admin/site-projects?id=${encodeURIComponent(editing.id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as Record<string, string>));
        setFormError(data?.error || 'Gagal menghapus site project.');
        return;
      }
      setSuccess('Site project berhasil dihapus.');
      setOpened(false);
      await refresh();
    } catch {
      setFormError('Tidak dapat terhubung ke server. Coba lagi nanti.');
    } finally {
      setSubmitting(false);
    }
  };

  type RowView = SiteProjectRow & { capacityLabel: string };

  const columns: DataTableColumn<RowView>[] = [
    { accessorKey: 'code', header: 'Kode', sortable: true },
    { accessorKey: 'name', header: 'Nama', sortable: true },
    { accessorKey: 'legalEntity', header: 'Badan Usaha' },
    { accessorKey: 'city', header: 'Kota' },
    { accessorKey: 'capacityLabel', header: 'Kapasitas' },
    { accessorKey: 'status', header: 'Status' },
  ];

  const data: RowView[] = paged.map((row) => ({
    ...row,
    capacityLabel: Number(row.capacity).toLocaleString('id-ID'),
  }));

  const inputStyles = { input: { minHeight: 44 } };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Site Project</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
            Kelola daftar site peternakan beserta kapasitas dan statusnya.
          </p>
        </div>
        <Button onClick={openCreate} styles={{ root: { minHeight: 44 } }}>
          Tambah Site Project
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
            <span>{editing ? 'Edit Site Project' : 'Tambah Site Project'}</span>
            {editing && <StatusBadge status={editing.status} />}
          </Group>
        }
      >
        <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
          <Stack gap="sm">
            {formError && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {formError}
              </Alert>
            )}

            <TextInput
              label="Nama site"
              placeholder="cth. Peternakan Sentosa"
              value={form.name}
              onChange={(e) => setField('name', e.currentTarget.value)}
              error={errors.name}
              styles={inputStyles}
            />
            <TextInput
              label="Badan usaha (PT)"
              placeholder="cth. PT Sentosa Ternak"
              value={form.legalEntity}
              onChange={(e) => setField('legalEntity', e.currentTarget.value)}
              error={errors.legalEntity}
              styles={inputStyles}
            />
            <Textarea
              label="Alamat"
              placeholder="Alamat lengkap site"
              value={form.address}
              onChange={(e) => setField('address', e.currentTarget.value)}
              error={errors.address}
              autosize
              minRows={2}
              styles={inputStyles}
            />
            <SearchableSelect
              label="Provinsi"
              placeholder="Pilih provinsi"
              data={PROVINCES}
              value={form.province}
              onChange={(value) => setField('province', value ?? '')}
              error={errors.province}
            />
            <TextInput
              label="Kabupaten/Kota"
              placeholder="cth. Surakarta"
              value={form.city}
              onChange={(e) => setField('city', e.currentTarget.value)}
              error={errors.city}
              styles={inputStyles}
            />
            <NumberInput
              label="Kapasitas (ekor)"
              placeholder="cth. 2500"
              value={form.capacity}
              onChange={(value) => setField('capacity', String(value ?? ''))}
              error={errors.capacity}
              min={1}
              max={10000}
              styles={{ input: { minHeight: 44 } }}
            />
            <Select
              label="Status"
              data={STATUS_OPTIONS}
              value={form.status}
              onChange={(value) => setField('status', value ?? 'ACTIVE')}
              styles={inputStyles}
              comboboxProps={{ keepMounted: false }}
            />
            <TextInput
              label="Nama desa (opsional)"
              value={form.village}
              onChange={(e) => setField('village', e.currentTarget.value)}
              styles={inputStyles}
            />
            <TextInput
              label="PIC (opsional)"
              value={form.contactPerson}
              onChange={(e) => setField('contactPerson', e.currentTarget.value)}
              styles={inputStyles}
            />
            <TextInput
              label="Telepon PIC (opsional)"
              value={form.contactPhone}
              onChange={(e) => setField('contactPhone', e.currentTarget.value)}
              styles={inputStyles}
            />
            <Textarea
              label="Deskripsi (opsional)"
              value={form.description}
              onChange={(e) => setField('description', e.currentTarget.value)}
              autosize
              minRows={2}
              styles={inputStyles}
            />

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
                <Button onClick={handleSubmit} loading={submitting} styles={{ root: { minHeight: 44 } }}>
                  {editing ? 'Simpan Perubahan' : 'Simpan'}
                </Button>
              </Group>
            </Group>
          </Stack>
        </div>
      </BaseModal>
    </Stack>
  );
}
