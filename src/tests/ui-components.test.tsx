import '@testing-library/jest-dom/vitest';

import { MantineProvider, Button, Text } from '@mantine/core';
import { IconWallet } from '@tabler/icons-react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { BaseModal } from '@/components/ui/BaseModal';
import { ChartCard } from '@/components/ui/ChartCard';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MetricCard } from '@/components/ui/MetricCard';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { STATUS_COLORS, StatusBadge } from '@/components/ui/StatusBadge';
import { usePaginatedQuery } from '@/hooks/usePaginatedQuery';
import { theme } from '@/theme/theme';

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <MantineProvider theme={theme} env="test">
      {ui}
    </MantineProvider>
  );
}

function ModalHarness() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Button onClick={() => setOpened(true)}>Lihat detail paket</Button>
      <BaseModal opened={opened} onClose={() => setOpened(false)} title="Detail Paket">
        <Text>Paket Kambing Etawa Lokal</Text>
      </BaseModal>
    </>
  );
}

type PackageRow = {
  id: string;
  name: string;
  status: string;
};

const packageColumns = [
  { accessorKey: 'name' as const, header: 'Nama Paket', sortable: true },
  { accessorKey: 'status' as const, header: 'Status' },
];

describe('reusable UI components', () => {
  it('BaseModal opens and closes with Escape', async () => {
    const user = userEvent.setup();
    renderWithTheme(<ModalHarness />);

    await user.click(screen.getByRole('button', { name: 'Lihat detail paket' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('DataTable displays search, filter, pagination controls', () => {
    const rows: PackageRow[] = [
      { id: 'p1', name: 'Paket Kambing Etawa Q1', status: 'OPEN' },
      { id: 'p2', name: 'Paket Sapi Limousin Q2', status: 'RUNNING' },
    ];

    renderWithTheme(
      <DataTable
        data={rows}
        columns={packageColumns}
        filters={[
          {
            label: 'Status',
            value: 'status',
            options: [
              { label: 'Terbuka', value: 'OPEN' },
              { label: 'Berjalan', value: 'RUNNING' },
            ],
          },
        ]}
        total={57}
        page={1}
        pageSize={10}
      />
    );

    expect(screen.getByLabelText('Cari data')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Baris per halaman')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Halaman sebelumnya' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Halaman berikutnya' })).toBeInTheDocument();
    expect(screen.getByText('Nama Paket')).toBeInTheDocument();
    expect(screen.getByText('Paket Kambing Etawa Q1')).toBeInTheDocument();
  });

  it('SearchableSelect filters with debounce 300ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSearchChange = vi.fn();

    renderWithTheme(
      <SearchableSelect
        label="Jenis ternak"
        data={[
          { value: 'limousin', label: 'Sapi Limousin' },
          { value: 'etawa', label: 'Kambing Etawa' },
          { value: 'simmental', label: 'Sapi Simmental' },
        ]}
        onSearchChange={onSearchChange}
      />
    );

    const input = screen.getByLabelText('Jenis ternak');
    await user.click(input);
    await user.type(input, 'etawa');

    expect(onSearchChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole('option')).toHaveLength(3);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearchChange).toHaveBeenCalledWith('etawa');
    expect(screen.getByRole('option', { name: 'Kambing Etawa' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sapi Limousin' })).not.toBeInTheDocument();
  });

  it('EmptyState renders when rows are empty', () => {
    renderWithTheme(
      <DataTable<PackageRow>
        data={[]}
        columns={packageColumns}
        total={0}
        page={1}
        pageSize={10}
      />
    );

    expect(screen.getByText('Belum ada data')).toBeInTheDocument();
  });

  it('LoadingState renders during loading', () => {
    renderWithTheme(
      <DataTable<PackageRow>
        data={[]}
        columns={packageColumns}
        loading
        total={0}
        page={1}
        pageSize={10}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Memuat...')).toBeInTheDocument();
  });

  it('DataTable exposes sortable headers through keyboard-accessible buttons', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    renderWithTheme(
      <DataTable
        data={[{ id: 'p1', name: 'Paket', status: 'OPEN' }]}
        columns={packageColumns}
        total={1}
        page={1}
        pageSize={10}
        onSortChange={onSortChange}
      />
    );

    const sortButton = screen.getByRole('button', { name: 'Urutkan Nama Paket' });
    await user.click(sortButton);

    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' });
  });

  it('ErrorState invokes its retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderWithTheme(<ErrorState onRetry={onRetry} />);

    expect(screen.getByText('Terjadi kesalahan')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('StatusBadge maps status colors and renders the status', () => {
    renderWithTheme(<StatusBadge status="PENDING" />);

    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(STATUS_COLORS.PENDING).toBe('yellow');
    expect(STATUS_COLORS.ACTIVE).toBe('green');
  });

  it('MetricCard displays its value and trend', () => {
    renderWithTheme(
      <MetricCard
        icon={<IconWallet aria-hidden="true" />}
        label="Total investasi"
        value="Rp12.500.000"
        trend={{ direction: 'up', value: '12,5%' }}
      />
    );

    expect(screen.getByText('Total investasi')).toBeInTheDocument();
    expect(screen.getByText('Rp12.500.000')).toBeInTheDocument();
    expect(screen.getByLabelText('Tren naik 12,5%')).toBeInTheDocument();
  });

  it('ChartCard renders its title and chart content', () => {
    renderWithTheme(
      <ChartCard title="Tren profit bulanan">
        <div data-testid="chart-body">Grafik</div>
      </ChartCard>
    );

    expect(screen.getByText('Tren profit bulanan')).toBeInTheDocument();
    expect(screen.getByTestId('chart-body')).toBeInTheDocument();
  });

  it('usePaginatedQuery manages page and page size state', () => {
    const { result } = renderHook(() => usePaginatedQuery({ total: 120 }));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalPages).toBe(12);

    act(() => result.current.setPage(5));
    expect(result.current.page).toBe(5);

    act(() => result.current.setPageSize(25));
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(5);

    act(() => result.current.setSearch('kambing'));
    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe('kambing');
  });

  it('EmptyState supports an accessible call to action', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    renderWithTheme(
      <EmptyState
        title="Belum ada paket"
        description="Buat paket pertama untuk mulai mengelola investasi."
        action={{ label: 'Buat paket', onClick: onAction }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Buat paket' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
