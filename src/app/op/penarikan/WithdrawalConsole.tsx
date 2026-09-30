'use client';

import {
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BaseModal } from '@/components/ui/BaseModal';
import { formatRupiah } from '@/lib/calculations';

export interface WithdrawalRow {
  id: string;
  amount: number;
  status: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  note: string | null;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  username: string | null;
  name: string | null;
}

type Action = 'APPROVED' | 'REJECTED' | 'PAID';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  PAID: 'Dibayar',
  REJECTED: 'Ditolak',
};

const ACTION_META: Record<
  Action,
  { label: string; confirmTitle: string; confirmBody: string; color: string }
> = {
  APPROVED: {
    label: 'Setujui',
    confirmTitle: 'Setujui permintaan penarikan ini?',
    confirmBody:
      'Saldo sudah dikunci saat pengajuan. Setelah disetujui, dana siap ditandai dibayar.',
    color: 'teal',
  },
  REJECTED: {
    label: 'Tolak',
    confirmTitle: 'Tolak permintaan penarikan ini?',
    confirmBody: 'Dana yang dikunci akan dikembalikan ke saldo tersedia pengguna.',
    color: 'red',
  },
  PAID: {
    label: 'Tandai Dibayar',
    confirmTitle: 'Tandai penarikan ini sudah dibayar?',
    confirmBody: 'Tandai hanya setelah transfer ke rekening pengguna benar-benar dilakukan.',
    color: 'green',
  },
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function userLabel(row: WithdrawalRow): string {
  if (row.username) return `@${row.username}`;
  return row.name || '-';
}

export function WithdrawalConsole() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ row: WithdrawalRow; action: Action } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/admin/withdrawals');
      if (!res.ok) throw new Error('gagal');
      const data = await res.json();
      setRows(Array.isArray(data.withdrawals) ? data.withdrawals : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmAction = useMemo(
    () => (pending ? ACTION_META[pending.action] : null),
    [pending]
  );

  async function submit() {
    if (!pending) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${pending.row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pending.action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || 'Gagal memproses penarikan');
        return;
      }
      setPending(null);
      await load();
    } catch {
      setActionError('Tidak dapat terhubung ke server. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingState text="Memuat permintaan penarikan..." />;
  }

  if (loadError) {
    return (
      <ErrorState
        title="Gagal memuat daftar penarikan"
        description="Data tidak dapat diambil dari server. Silakan coba lagi."
        onRetry={() => {
          void load();
        }}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Belum ada permintaan penarikan"
        description="Permintaan penarikan dari investor akan muncul di sini."
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

      <Paper withBorder>
        <Table.ScrollContainer minWidth={720}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pengguna</Table.Th>
                <Table.Th>Jumlah</Table.Th>
                <Table.Th>Bank</Table.Th>
                <Table.Th>Tanggal</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th aria-label="Aksi" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {userLabel(row)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {row.name || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatRupiah(row.amount)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.bankName || '-'}</Text>
                    <Text size="xs" c="dimmed">
                      {row.bankAccount || '-'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {row.bankHolder || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatDate(row.createdAt)}</Table.Td>
                  <Table.Td>
                    <StatusBadge
                      status={row.status}
                      label={STATUS_LABEL[row.status] ?? row.status}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {row.status === 'PENDING' && (
                        <>
                          <Button
                            size="xs"
                            color="teal"
                            onClick={() => {
                              setActionError(null);
                              setPending({ row, action: 'APPROVED' });
                            }}
                            styles={{ root: { minHeight: 44 } }}
                          >
                            Setujui
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() => {
                              setActionError(null);
                              setPending({ row, action: 'REJECTED' });
                            }}
                            styles={{ root: { minHeight: 44 } }}
                          >
                            Tolak
                          </Button>
                        </>
                      )}
                      {row.status === 'APPROVED' && (
                        <Button
                          size="xs"
                          color="green"
                          onClick={() => {
                            setActionError(null);
                            setPending({ row, action: 'PAID' });
                          }}
                          styles={{ root: { minHeight: 44 } }}
                        >
                          Tandai Dibayar
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      <BaseModal
        opened={pending !== null}
        onClose={() => setPending(null)}
        title={confirmAction?.confirmTitle ?? 'Konfirmasi'}
      >
        {pending && confirmAction && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {confirmAction.confirmBody}
            </Text>
            <Stack gap={4}>
              <Text size="sm">
                <b>Pengguna:</b> {userLabel(pending.row)}
              </Text>
              <Text size="sm">
                <b>Jumlah:</b> {formatRupiah(pending.row.amount)}
              </Text>
              <Text size="sm">
                <b>Bank:</b> {pending.row.bankName || '-'} • {pending.row.bankAccount || '-'}
              </Text>
            </Stack>

            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => setPending(null)}
                styles={{ root: { minHeight: 44 } }}
              >
                Batal
              </Button>
              <Button
                color={confirmAction.color}
                loading={submitting}
                onClick={submit}
                styles={{ root: { minHeight: 44 } }}
              >
                Ya, {confirmAction.label}
              </Button>
            </Group>
          </Stack>
        )}
      </BaseModal>
    </Stack>
  );
}
