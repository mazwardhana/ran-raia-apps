'use client';

import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';

export interface UserRow {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  kycStatus: string;
  createdAt: string;
}

export interface UserConsoleProps {
  /** Role sesi dari server — menentukan apakah role boleh diubah. */
  sessionRole: string;
}

const KYC_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  VERIFIED: 'Terverifikasi',
  REJECTED: 'Ditolak',
};

const KYC_OPTIONS = [
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'VERIFIED', label: 'Terverifikasi' },
  { value: 'REJECTED', label: 'Ditolak' },
];

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'OPERATOR', label: 'OPERATOR' },
  { value: 'INVESTOR', label: 'INVESTOR' },
];

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'grape',
  OPERATOR: 'teal',
  INVESTOR: 'blue',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function UserConsole({ sessionRole }: UserConsoleProps) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [nextKyc, setNextKyc] = useState<string | null>(null);
  const [nextRole, setNextRole] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canEditRole = sessionRole === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('gagal');
      const data = await res.json();
      setRows(Array.isArray(data.users) ? data.users : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.username, row.name, row.email].some((field) =>
        (field || '').toLowerCase().includes(query)
      )
    );
  }, [rows, search]);

  function openDialog(row: UserRow) {
    setActionError(null);
    setSelected(row);
    setNextKyc(row.kycStatus);
    setNextRole(row.role);
  }

  const hasChanges =
    selected !== null &&
    (nextKyc !== selected.kycStatus ||
      (canEditRole && nextRole !== selected.role));

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const body: Record<string, string> = {};
      if (nextKyc && nextKyc !== selected.kycStatus) body.kycStatus = nextKyc;
      if (canEditRole && nextRole && nextRole !== selected.role) {
        body.role = nextRole;
      }

      const res = await fetch(`/api/admin/users/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || 'Gagal memperbarui pengguna');
        return;
      }
      setSelected(null);
      await load();
    } catch {
      setActionError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingState text="Memuat daftar pengguna..." />;
  }

  if (loadError) {
    return (
      <ErrorState
        title="Gagal memuat daftar pengguna"
        description="Data tidak dapat diambil dari server. Silakan coba lagi."
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  return (
    <Stack gap="md">
      {actionError && (
        <Alert
          icon={<IconAlertCircle size={18} />}
          color="red"
          variant="light"
          role="alert"
        >
          {actionError}
        </Alert>
      )}

      <TextInput
        placeholder="Cari pengguna"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        aria-label="Cari pengguna"
        styles={{ input: { minHeight: 44 } }}
        maw={360}
      />

      {visibleRows.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'Belum ada pengguna' : 'Pengguna tidak ditemukan'}
          description={
            rows.length === 0
              ? 'Akun pengguna akan muncul di sini.'
              : 'Tidak ada pengguna yang cocok dengan pencarian Anda.'
          }
        />
      ) : (
        <Paper withBorder>
          <Table.ScrollContainer minWidth={720}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pengguna</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status KYC</Table.Th>
                  <Table.Th>Tanggal</Table.Th>
                  <Table.Th aria-label="Aksi" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleRows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        @{row.username}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {row.name || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{row.email}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={ROLE_COLOR[row.role] || 'gray'}
                        variant="light"
                        data-role={row.role}
                      >
                        {row.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge
                        status={row.kycStatus}
                        label={KYC_LABEL[row.kycStatus] ?? row.kycStatus}
                      />
                    </Table.Td>
                    <Table.Td>{formatDate(row.createdAt)}</Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => openDialog(row)}
                        styles={{ root: { minHeight: 44 } }}
                      >
                        Ubah
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}

      <BaseModal
        opened={selected !== null}
        onClose={() => setSelected(null)}
        title="Ubah pengguna"
      >
        {selected && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              @{selected.username} · {selected.name}
            </Text>

            <Select
              label="Status KYC"
              data={KYC_OPTIONS}
              value={nextKyc}
              onChange={setNextKyc}
              allowDeselect={false}
              styles={{ input: { minHeight: 44 } }}
              comboboxProps={{ keepMounted: false }}
            />

            <Select
              label="Role"
              data={ROLE_OPTIONS}
              value={nextRole}
              onChange={setNextRole}
              disabled={!canEditRole}
              allowDeselect={false}
              description={
                canEditRole
                  ? undefined
                  : 'Hanya admin yang dapat mengubah role.'
              }
              styles={{ input: { minHeight: 44 } }}
              comboboxProps={{ keepMounted: false }}
            />

            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => setSelected(null)}
                styles={{ root: { minHeight: 44 } }}
              >
                Batal
              </Button>
              <Button
                loading={submitting}
                disabled={!hasChanges}
                onClick={submit}
                styles={{ root: { minHeight: 44 } }}
              >
                Simpan
              </Button>
            </Group>
          </Stack>
        )}
      </BaseModal>
    </Stack>
  );
}
