'use client';

import { Card, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupiah } from '@/lib/calculations';

export interface TransaksiRow {
  id: string;
  orderId: string;
  type: string;
  status: string;
  amount: number;
  createdAt: string | Date;
}

export interface TransaksiTableProps {
  rows: TransaksiRow[];
}

const TYPE_OPTIONS = ['BUY', 'SELL', 'PAYOUT', 'TAAWUN_CLAIM', 'TAKEOVER'];
const STATUS_OPTIONS = ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED'];

// Di bawah 768px tabel 5 kolom tidak terbaca: tiap transaksi dirender sebagai
// kartu bertumpuk agar nominal dan status tetap terbaca tanpa geser samping.
const MOBILE_QUERY = '(max-width: 767px)';

function TransaksiCard({ row }: { row: TransaksiRow }) {
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text fw={600} size="sm" style={{ wordBreak: 'break-all' }}>
            {row.orderId}
          </Text>
          <StatusBadge status={row.status} />
        </Group>
        <Group justify="space-between" gap="sm">
          <Text size="sm" c="dimmed">
            Tipe
          </Text>
          <Text size="sm" fw={500}>
            {row.type}
          </Text>
        </Group>
        <Group justify="space-between" gap="sm">
          <Text size="sm" c="dimmed">
            Jumlah
          </Text>
          <Text size="sm" fw={700}>
            {formatRupiah(row.amount)}
          </Text>
        </Group>
        <Group justify="space-between" gap="sm">
          <Text size="sm" c="dimmed">
            Tanggal
          </Text>
          <Text size="sm">{dayjs(row.createdAt).format('DD MMM YYYY HH:mm')}</Text>
        </Group>
      </Stack>
    </Card>
  );
}

export function TransaksiTable({ rows }: TransaksiTableProps) {
  const [type, setType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (type && row.type !== type) return false;
      if (status && row.status !== status) return false;
      if (q && !row.orderId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, type, status, query]);

  if (rows.length === 0) {
    return <EmptyState title="Belum ada transaksi." />;
  }

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Select
          label="Tipe"
          placeholder="Semua tipe"
          data={TYPE_OPTIONS}
          value={type}
          onChange={setType}
          clearable
          allowDeselect
        />
        <Select
          label="Status"
          placeholder="Semua status"
          data={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          clearable
          allowDeselect
        />
        <TextInput
          label="Cari orderId"
          placeholder="Cari orderId"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
        />
      </Stack>

      {filtered.length === 0 ? (
        <Text size="sm" c="dimmed">
          Tidak ada transaksi yang cocok dengan filter.
        </Text>
      ) : isMobile ? (
        <Stack gap="sm">
          {filtered.map((row) => (
            <TransaksiCard key={row.id} row={row} />
          ))}
        </Stack>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order ID</Table.Th>
                <Table.Th>Tipe</Table.Th>
                <Table.Th ta="right">Jumlah</Table.Th>
                <Table.Th>Tanggal</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.orderId}</Table.Td>
                  <Table.Td>{row.type}</Table.Td>
                  <Table.Td ta="right">{formatRupiah(row.amount)}</Table.Td>
                  <Table.Td>
                    {dayjs(row.createdAt).format('DD MMM YYYY HH:mm')}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={row.status} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
