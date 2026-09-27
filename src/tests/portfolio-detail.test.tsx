import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/prisma';
import { theme } from '@/theme/theme';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({
  prisma: {} as {
    lotOwnership: { findFirst: ReturnType<typeof vi.fn> };
    fullOwnership: { findFirst: ReturnType<typeof vi.fn> };
    package: { findUnique: ReturnType<typeof vi.fn> };
    livestockEvent: { findMany: ReturnType<typeof vi.fn> };
    milkLog: { findMany: ReturnType<typeof vi.fn> };
    profitDistribution: { findMany: ReturnType<typeof vi.fn> };
  },
  auth: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    lotOwnership: { findFirst: vi.fn() },
    fullOwnership: { findFirst: vi.fn() },
    package: { findUnique: vi.fn() },
    livestockEvent: { findMany: vi.fn() },
    milkLog: { findMany: vi.fn() },
    profitDistribution: { findMany: vi.fn() },
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
      removeListener: {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
});

beforeEach(() => {
  state.prisma.lotOwnership.findFirst.mockReset().mockResolvedValue(null);
  state.prisma.fullOwnership.findFirst.mockReset().mockResolvedValue(null);
  state.prisma.package.findUnique.mockReset().mockResolvedValue(null);
  state.prisma.livestockEvent.findMany.mockReset().mockResolvedValue([]);
  state.prisma.milkLog.findMany.mockReset().mockResolvedValue([]);
  state.prisma.profitDistribution.findMany.mockReset().mockResolvedValue([]);
});

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Portofolio detail (ownership)', () => {
  it('renders package header, timeline, profit row and Jual Aset link', async () => {
    state.prisma.lotOwnership.findFirst.mockResolvedValue({
      id: 'lot1',
      packageId: 'pkg1',
      lotStart: 1,
      lotEnd: 10,
      acquiredPrice: 100000,
      transactionId: 't1',
      createdAt: new Date('2026-01-10T00:00:00Z'),
    });

    state.prisma.package.findUnique.mockResolvedValue({
      id: 'pkg1',
      title: 'Paket Kambing Etawa',
      animalType: 'KAMBING',
      status: 'RUNNING',
      price: 1000000,
      lotPrice: 10000,
      totalLots: 100,
    });

    state.prisma.livestockEvent.findMany.mockResolvedValue([
      {
        id: 'ev1',
        eventType: 'WEIGHT_LOG',
        eventDate: new Date('2026-02-01T00:00:00Z'),
        description: 'Bobot naik jadi 42 kg',
        livestock: { tagNumber: 'K-001', name: 'Etawa' },
      },
    ]);

    state.prisma.milkLog.findMany.mockResolvedValue([
      {
        id: 'm1',
        logDate: new Date('2026-02-01T00:00:00Z'),
        morningLt: 2,
        eveningLt: 1.5,
        totalLt: 3.5,
      },
      {
        id: 'm2',
        logDate: new Date('2026-02-02T00:00:00Z'),
        morningLt: 2,
        eveningLt: 2,
        totalLt: 4,
      },
      {
        id: 'm3',
        logDate: new Date('2026-02-03T00:00:00Z'),
        morningLt: 1,
        eveningLt: 1,
        totalLt: 2,
      },
    ]);

    state.prisma.profitDistribution.findMany.mockResolvedValue([
      {
        id: 'pd1',
        packageId: 'pkg1',
        period: '2026-02',
        source: 'MILK',
        investorShare: 75000,
        status: 'DISTRIBUTED',
      },
    ]);

    const OwnershipPage = (
      await import('@/app/app/portofolio/[id]/page')
    ).default;
    const ui = await OwnershipPage({ params: { id: 'lot1' } });
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByText('Paket Kambing Etawa')).toBeInTheDocument();
    });

    expect(screen.getByText('Kambing')).toBeInTheDocument();
    expect(screen.getByText(/Lot 1–10/)).toBeInTheDocument();

    const jualAset = screen.getByRole('link', { name: /jual aset/i });
    expect(jualAset).toHaveAttribute(
      'href',
      '/app/secondary?ownershipId=lot1'
    );

    expect(screen.getByText(/75\.000/)).toBeInTheDocument();
    expect(screen.getByText('2026-02')).toBeInTheDocument();

    expect(screen.getByText(/Bobot naik jadi 42 kg/)).toBeInTheDocument();
    expect(screen.getByText(/K-001/)).toBeInTheDocument();
  });

  it('shows honest empty states when there is no activity data', async () => {
    state.prisma.fullOwnership.findFirst.mockResolvedValue({
      id: 'full1',
      packageId: 'pkg2',
      acquiredPrice: 1000000,
      transactionId: 't2',
      createdAt: new Date('2026-01-05T00:00:00Z'),
    });
    state.prisma.package.findUnique.mockResolvedValue({
      id: 'pkg2',
      title: 'Paket Sapi Utuh',
      animalType: 'SAPI',
      status: 'RUNNING',
      price: 1000000,
      lotPrice: 10000,
      totalLots: 1,
    });

    const OwnershipPage = (
      await import('@/app/app/portofolio/[id]/page')
    ).default;
    const ui = await OwnershipPage({ params: { id: 'full1' } });
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByText('Paket Sapi Utuh')).toBeInTheDocument();
    });

    expect(screen.getByText(/Paket utuh/)).toBeInTheDocument();
    expect(
      screen.getByText(/Belum ada catatan aktivitas ternak\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Belum ada distribusi profit untuk paket ini\./)
    ).toBeInTheDocument();
  });
});
