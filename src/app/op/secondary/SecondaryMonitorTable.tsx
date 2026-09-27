'use client';

import { Button, Group, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { DataTable, DataTableColumn, DataTableFilter } from '@/components/ui/DataTable';

export interface MonitorRow extends Record<string, unknown> {
  id: string;
  status: string;
  statusLabel: string;
  packageCode: string;
  packageTitle: string;
  sellerName: string;
  buyerName: string;
  listingPrice: string;
  listedAt: string;
  expiresAt: string;
  takeoverLabel: string;
}

const STATUS_OPTIONS = [
  { label: 'Aktif', value: 'ACTIVE' },
  { label: 'Terjual', value: 'SOLD' },
  { label: 'Kedaluwarsa', value: 'EXPIRED' },
  { label: 'Takeover', value: 'TAKEOVER' },
  { label: 'Dibatalkan', value: 'CANCELLED' },
];

const columns: DataTableColumn<MonitorRow>[] = [
  { accessorKey: 'statusLabel', header: 'Status' },
  { accessorKey: 'packageTitle', header: 'Paket' },
  { accessorKey: 'packageCode', header: 'Kode' },
  { accessorKey: 'sellerName', header: 'Penjual' },
  { accessorKey: 'buyerName', header: 'Pembeli' },
  { accessorKey: 'listingPrice', header: 'Harga' },
  { accessorKey: 'listedAt', header: 'Listed' },
  { accessorKey: 'expiresAt', header: 'Expires' },
  { accessorKey: 'takeoverLabel', header: 'Takeover' },
];

const filters: DataTableFilter[] = [
  { label: 'Status', value: 'status', options: STATUS_OPTIONS },
];

export function SecondaryMonitorTable({
  rows,
  currentStatus,
}: {
  rows: MonitorRow[];
  currentStatus: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    let result = rows;
    if (currentStatus) {
      result = result.filter((r) => r.status === currentStatus);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.packageTitle.toLowerCase().includes(q) ||
          r.packageCode.toLowerCase().includes(q) ||
          r.sellerName.toLowerCase().includes(q) ||
          r.buyerName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, currentStatus, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      if (key === 'status') {
        const url = new URL(window.location.href);
        if (value) {
          url.searchParams.set('status', value);
        } else {
          url.searchParams.delete('status');
        }
        router.push(url.pathname + url.search);
      }
    },
    [router]
  );

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleResetFilter = useCallback(() => {
    router.push(window.location.pathname);
  }, [router]);

  const activeStatusLabel = currentStatus
    ? STATUS_OPTIONS.find((o) => o.value === currentStatus)?.label || currentStatus
    : '';

  return (
    <>
      {currentStatus && (
        <Group gap="xs">
          <Text size="sm">Filter status: {activeStatusLabel}</Text>
          <Button
            variant="subtle"
            size="xs"
            onClick={handleResetFilter}
            styles={{ root: { minHeight: 44 } }}
          >
            Reset filter
          </Button>
        </Group>
      )}
      <DataTable<MonitorRow>
        data={paged}
        columns={columns}
        filters={filters}
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onFilterChange={handleFilterChange}
      />
    </>
  );
}
