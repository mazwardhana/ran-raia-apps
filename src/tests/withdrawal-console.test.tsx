import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { theme } from '@/theme/theme';
import { formatRupiah } from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Data contoh — satu baris per status supaya tombol aksi tiap status teruji.
// ---------------------------------------------------------------------------

const rows = [
  {
    id: 'wd-pending',
    amount: 150000,
    status: 'PENDING',
    bankName: 'Bank Syariah Indonesia',
    bankAccount: '1234567890',
    bankHolder: 'Budi Santoso',
    note: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    approvedAt: null,
    paidAt: null,
    username: 'budi',
    name: 'Budi Santoso',
  },
  {
    id: 'wd-approved',
    amount: 250000,
    status: 'APPROVED',
    bankName: 'Bank Mandiri',
    bankAccount: '9876543210',
    bankHolder: 'Sari Dewi',
    note: null,
    createdAt: '2026-09-02T00:00:00.000Z',
    approvedAt: '2026-09-03T00:00:00.000Z',
    paidAt: null,
    username: 'sari',
    name: 'Sari Dewi',
  },
  {
    id: 'wd-paid',
    amount: 500000,
    status: 'PAID',
    bankName: 'BCA',
    bankAccount: '1112223330',
    bankHolder: 'Agus Salim',
    note: null,
    createdAt: '2026-09-04T00:00:00.000Z',
    approvedAt: '2026-09-05T00:00:00.000Z',
    paidAt: '2026-09-06T00:00:00.000Z',
    username: 'agus',
    name: 'Agus Salim',
  },
  {
    id: 'wd-rejected',
    amount: 75000,
    status: 'REJECTED',
    bankName: 'BNI',
    bankAccount: '4445556660',
    bankHolder: 'Rina Kartika',
    note: 'Ditolak operator',
    createdAt: '2026-09-07T00:00:00.000Z',
    approvedAt: null,
    paidAt: null,
    username: 'rina',
    name: 'Rina Kartika',
  },
];

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

function makeFetch(payload: unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (method === 'PATCH') {
      return jsonResponse(200, { success: true });
    }
    if (url.includes('/api/admin/withdrawals')) {
      return jsonResponse(200, payload);
    }
    throw new Error(`Unhandled fetch in test: ${method} ${url}`);
  });
}

function makeFailingFetch() {
  return vi.fn(async () => jsonResponse(500, { error: 'boom' }));
}

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
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

beforeEach(() => {
  fetchMock = makeFetch({ withdrawals: rows });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderConsole(fetchImpl?: ReturnType<typeof vi.fn>) {
  if (fetchImpl) {
    fetchMock = fetchImpl;
    vi.stubGlobal('fetch', fetchImpl);
  }
  const { WithdrawalConsole } = await import('@/app/op/penarikan/WithdrawalConsole');
  render(
    <MantineProvider theme={theme}>
      <WithdrawalConsole />
    </MantineProvider>
  );
}

function getRequests() {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).includes('/api/admin/withdrawals')
  );
}

// ---------------------------------------------------------------------------
// Tes
// ---------------------------------------------------------------------------

describe('Konsol penarikan operator', () => {
  it('memuat baris dari GET /api/admin/withdrawals dengan label status Indonesia', async () => {
    await renderConsole();

    expect(await screen.findByText('@budi')).toBeInTheDocument();
    expect(screen.getByText('@sari')).toBeInTheDocument();
    expect(screen.getByText('@agus')).toBeInTheDocument();
    expect(screen.getByText('@rina')).toBeInTheDocument();

    const rupiah = (value: number) =>
      screen.getByText((content) =>
        content.replace(/\s/g, ' ') === formatRupiah(value).replace(/\s/g, ' ')
      );
    expect(rupiah(150000)).toBeInTheDocument();

    expect(screen.getByText('Menunggu')).toBeInTheDocument();
    expect(screen.getByText('Disetujui')).toBeInTheDocument();
    expect(screen.getByText('Dibayar')).toBeInTheDocument();
    expect(screen.getByText('Ditolak')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/withdrawals');
  });

  it('menampilkan tombol aksi hanya untuk status yang mengizinkan', async () => {
    await renderConsole();
    await screen.findByText('@budi');

    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Setujui',
      'Tolak',
      'Tandai Dibayar',
    ]);
  });

  it('menyetujui penarikan memanggil PATCH lalu memuat ulang daftar', async () => {
    await renderConsole();
    await screen.findByText('@budi');

    await userEvent.click(screen.getByRole('button', { name: 'Setujui' }));

    // Dialog konfirmasi muncul sebelum aksi dikirim.
    expect(
      await screen.findByText('Setujui permintaan penarikan ini?')
    ).toBeInTheDocument();
    expect(getRequests().some((call) => call[1]?.method === 'PATCH')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Ya, Setujui' }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH'
      );
      expect(patch).toBeTruthy();
      expect(String(patch![0])).toBe('/api/admin/withdrawals/wd-pending');
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({
        action: 'APPROVED',
      });
    });

    await waitFor(() => {
      const gets = getRequests().filter(
        (call) => ((call[1] as RequestInit | undefined)?.method || 'GET').toUpperCase() === 'GET'
      );
      expect(gets.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('menandai dibayar mengirim aksi PAID untuk baris APPROVED', async () => {
    await renderConsole();
    await screen.findByText('@sari');

    await userEvent.click(screen.getByRole('button', { name: 'Tandai Dibayar' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ya, Tandai Dibayar' })
    );

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH'
      );
      expect(patch).toBeTruthy();
      expect(String(patch![0])).toBe('/api/admin/withdrawals/wd-approved');
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({
        action: 'PAID',
      });
    });
  });

  it('menampilkan empty state saat tidak ada penarikan', async () => {
    await renderConsole(makeFetch({ withdrawals: [] }));

    expect(
      await screen.findByText('Belum ada permintaan penarikan')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Setujui' })).not.toBeInTheDocument();
  });

  it('menampilkan error state saat pengambilan data gagal', async () => {
    await renderConsole(makeFailingFetch());

    expect(
      await screen.findByText('Gagal memuat daftar penarikan')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
