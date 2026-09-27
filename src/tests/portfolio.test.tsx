import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/prisma';
import { theme } from '@/theme/theme';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({
  prisma: {} as {
    lotOwnership: { findMany: ReturnType<typeof vi.fn> };
    fullOwnership: { findMany: ReturnType<typeof vi.fn> };
    package: { findMany: ReturnType<typeof vi.fn> };
    profitDistribution: { findMany: ReturnType<typeof vi.fn> };
    investorBalance: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    withdrawal: { create: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
    user: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  },
  auth: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    lotOwnership: { findMany: vi.fn() },
    fullOwnership: { findMany: vi.fn() },
    package: { findMany: vi.fn() },
    profitDistribution: { findMany: vi.fn() },
    investorBalance: { findUnique: vi.fn(), update: vi.fn() },
    withdrawal: { create: vi.fn(), findMany: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn() },
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
  state.prisma.lotOwnership.findMany.mockReset().mockResolvedValue([]);
  state.prisma.fullOwnership.findMany.mockReset().mockResolvedValue([]);
  state.prisma.package.findMany.mockReset().mockResolvedValue([]);
  state.prisma.profitDistribution.findMany.mockReset().mockResolvedValue([]);
  state.prisma.investorBalance.findUnique.mockReset().mockResolvedValue({
    availableBalance: 100000,
    withdrawnBalance: 0,
    totalEarned: 100000,
  });
  state.prisma.withdrawal.create.mockReset().mockResolvedValue({ id: 'wd-1' });
  state.prisma.withdrawal.findMany.mockReset().mockResolvedValue([]);
  state.prisma.user.findFirst.mockReset().mockResolvedValue(null);
  state.prisma.user.update.mockReset().mockResolvedValue({
    id: 'user-1',
    username: 'new_username',
  });
});

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Portfolio, Withdrawal, Profile', () => {
  it('portfolio page renders lot and full ownerships with aggregated metrics', async () => {
    state.prisma.lotOwnership.findMany.mockResolvedValue([
      {
        id: 'lot1',
        packageId: 'pkg1',
        lotStart: 1,
        lotEnd: 100,
        acquiredPrice: 10000,
      },
    ]);

    state.prisma.fullOwnership.findMany.mockResolvedValue([
      {
        id: 'full1',
        packageId: 'pkg2',
        acquiredPrice: 10000000,
      },
    ]);

    state.prisma.package.findMany.mockResolvedValue([
      {
        id: 'pkg1',
        title: 'Paket Kambing Lot',
        animalType: 'KAMBING',
        totalLots: 1000,
      },
      {
        id: 'pkg2',
        title: 'Paket Sapi Utuh',
        animalType: 'SAPI',
        totalLots: 1,
      },
    ]);

    state.prisma.profitDistribution.findMany.mockResolvedValue([
      { packageId: 'pkg1', investorShare: 50000 },
      { packageId: 'pkg2', investorShare: 200000 },
    ]);

    const PortfolioPage = (await import('@/app/app/portofolio/page')).default;
    const ui = await PortfolioPage();
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByText('Paket Kambing Lot')).toBeInTheDocument();
    });

    expect(screen.getByText('Paket Sapi Utuh')).toBeInTheDocument();
    expect(screen.getByText(/LOT/)).toBeInTheDocument();
    expect(screen.getByText(/FULL/)).toBeInTheDocument();
  });

  it('withdrawal rejects amount below 50000', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Minimum penarikan Rp50.000' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const PenarikanPage = (await import('@/app/app/penarikan/page')).default;
    renderWithTheme(<PenarikanPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/jumlah/i)).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText(/jumlah/i);
    const submitButton = screen.getByRole('button', { name: /ajukan/i });

    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '40000');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/minimum.*50\.000/i)).toBeInTheDocument();
    });
  });

  it('withdrawal rejects amount exceeding available balance', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Saldo tidak mencukupi' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const PenarikanPage = (await import('@/app/app/penarikan/page')).default;
    renderWithTheme(<PenarikanPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/jumlah/i)).toBeInTheDocument();
    });

    const amountInput = screen.getByLabelText(/jumlah/i);
    const submitButton = screen.getByRole('button', { name: /ajukan/i });

    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '150000');
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/saldo tidak mencukupi/i)).toBeInTheDocument();
    });
  });

  it('profile username update rejects duplicate username', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Username sudah digunakan' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const ProfilPage = (await import('@/app/app/profil/page')).default;
    const ui = await ProfilPage();
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByText(/username/i)).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /ubah username/i });
    await userEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/username baru/i)).toBeInTheDocument();
    });

    const usernameInput = screen.getByLabelText(/username baru/i);
    const saveButton = screen.getByRole('button', { name: /simpan/i });

    await userEvent.clear(usernameInput);
    await userEvent.type(usernameInput, 'existing_user');
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/username sudah digunakan/i)).toBeInTheDocument();
    });
  });
});
