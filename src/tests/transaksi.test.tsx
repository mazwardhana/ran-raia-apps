import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/prisma';
import { theme } from '@/theme/theme';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({
  prisma: {} as {
    transaction: { findMany: ReturnType<typeof vi.fn> };
  },
  auth: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    transaction: { findMany: vi.fn() },
  };
  state.prisma = prisma;
  return { prisma };
});

vi.mock('@/lib/auth', () => {
  const auth = {
    getCurrentUser: vi.fn(async () => ({
      id: 'user-1',
      role: 'INVESTOR',
      username: 'investor_budi',
      kycStatus: 'VERIFIED',
    })),
  };
  state.auth = auth;
  return auth;
});

// Stub matchMedia yang bisa diubah per-test. `useMediaQuery` Mantine membaca
// `matches` di effect, jadi tes bisa mengunci jalur mobile (max-width: 767px).
let mediaMatches = false;

function stubMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: mediaMatches,
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
}

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

  stubMatchMedia();
});

beforeEach(() => {
  mediaMatches = false;
  stubMatchMedia();
  state.prisma.transaction.findMany.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  mediaMatches = false;
  stubMatchMedia();
});

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

const ROWS = [
  {
    id: 'tx1',
    orderId: 'ORD-2026-001',
    type: 'BUY',
    status: 'PAID',
    amount: 100000,
    createdAt: new Date('2026-01-15T10:00:00Z'),
  },
  {
    id: 'tx2',
    orderId: 'ORD-2026-002',
    type: 'SELL',
    status: 'PENDING',
    amount: 50000,
    createdAt: new Date('2026-02-20T08:30:00Z'),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Transaksi', () => {
  it('renders every transaction row with type, amount, date and status', async () => {
    state.prisma.transaction.findMany.mockResolvedValue(ROWS);

    const TransaksiPage = (await import('@/app/app/transaksi/page')).default;
    const ui = await TransaksiPage();
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByText('ORD-2026-001')).toBeInTheDocument();
    });

    expect(screen.getByText('ORD-2026-002')).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByText('BUY')).toBeInTheDocument();
    expect(within(table).getByText('SELL')).toBeInTheDocument();
    expect(within(table).getByText(/100\.000/)).toBeInTheDocument();
    expect(within(table).getByText(/50\.000/)).toBeInTheDocument();
    expect(within(table).getByText('PAID')).toBeInTheDocument();
    expect(within(table).getByText('PENDING')).toBeInTheDocument();
  });

  it('narrows the list when searching by orderId', async () => {
    state.prisma.transaction.findMany.mockResolvedValue(ROWS);

    const TransaksiPage = (await import('@/app/app/transaksi/page')).default;
    const ui = await TransaksiPage();
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByText('ORD-2026-002')).toBeInTheDocument();
    });

    const search = screen.getByLabelText(/cari orderId/i);
    await userEvent.type(search, 'ORD-2026-001');

    await waitFor(() => {
      expect(screen.queryByText('ORD-2026-002')).not.toBeInTheDocument();
    });

    expect(screen.getByText('ORD-2026-001')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).queryByText('ORD-2026-002')).not.toBeInTheDocument();
    expect(within(table).queryByText('PENDING')).not.toBeInTheDocument();
  });

  it('shows an honest empty state when the user has no transactions', async () => {
    state.prisma.transaction.findMany.mockResolvedValue([]);

    const TransaksiPage = (await import('@/app/app/transaksi/page')).default;
    const ui = await TransaksiPage();
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByText('Belum ada transaksi.')).toBeInTheDocument();
    });
  });

  it('renders stacked cards and no table at mobile width', async () => {
    mediaMatches = true;
    state.prisma.transaction.findMany.mockResolvedValue(ROWS);

    const TransaksiPage = (await import('@/app/app/transaksi/page')).default;
    const ui = await TransaksiPage();
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getAllByTestId('transaksi-card')).toHaveLength(ROWS.length);
    });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = screen.getAllByTestId('transaksi-card');
    expect(within(cards[0]).getByText('ORD-2026-001')).toBeInTheDocument();
    expect(within(cards[1]).getByText('ORD-2026-002')).toBeInTheDocument();
    expect(within(cards[0]).getByText('BUY')).toBeInTheDocument();
    expect(within(cards[1]).getByText('SELL')).toBeInTheDocument();
  });
});
