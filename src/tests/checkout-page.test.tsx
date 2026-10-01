import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { theme } from '@/theme/theme';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: 'pkg-1' }),
  usePathname: () => '/app/checkout/pkg-1',
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const pkg1 = {
  id: 'pkg-1',
  code: 'PCK-001',
  title: 'Paket Kambing Etawa Sleman',
  animalType: 'KAMBING',
  price: 100000000,
  lotPrice: 1000000,
  totalLots: 100,
  soldLots: 20,
  status: 'OPEN',
  coverImage: null,
  description: 'Paket investasi kambing etawa.',
  estimatedRoi: '12%',
  periodMonths: 12,
  startDate: '2026-01-01',
  endDate: '2027-01-01',
  maxInvestors: 100,
  siteProject: {
    id: 'sp-1',
    name: 'Kandang Sleman',
    legalEntity: 'PT Ternak Jaya',
    address: 'Jl. Sleman',
    province: 'DI Yogyakarta',
    city: 'Sleman',
  },
  costs: [],
  progress: { soldLots: 20, totalLots: 100, percent: 20 },
};

const pkg2 = {
  ...pkg1,
  id: 'pkg-2',
  code: 'PCK-002',
  title: 'Paket Kambing Kecil',
  lotPrice: 4000,
  soldLots: 0,
};

const pkg3 = {
  ...pkg1,
  id: 'pkg-3',
  code: 'PCK-003',
  title: 'Paket Sapi Utuh',
  animalType: 'SAPI',
  lotPrice: 500000,
  soldLots: 0,
};

const packages: Record<string, typeof pkg1> = {
  'pkg-1': pkg1,
  'pkg-2': pkg2,
  'pkg-3': pkg3,
};

function makeFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url.includes('/api/checkout')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          orderId: 'TRX-1',
          snapToken: 'snap-token-1',
          redirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/abc/token',
          total: 1000000,
        }),
      };
    }

    if (url.includes('/api/kyc')) {
      return { ok: true, status: 200, json: async () => ({ kycStatus: 'VERIFIED' }) };
    }

    const pkgMatch = url.match(/\/api\/packages\/([^/?]+)/);
    if (pkgMatch) {
      const pkg = packages[pkgMatch[1]];
      if (!pkg) {
        return { ok: false, status: 404, json: async () => ({ error: 'Paket tidak ditemukan' }) };
      }
      return { ok: true, status: 200, json: async () => pkg };
    }

    throw new Error(`Unhandled fetch in test: ${method} ${url}`);
  });
}

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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mediaMatches = false;
  stubMatchMedia();
  fetchMock = makeFetch();
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState({}, '', '/app/checkout/pkg-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
  mediaMatches = false;
  stubMatchMedia();
});

async function renderCheckout(id: string) {
  const CheckoutPage = (await import('@/app/app/checkout/[id]/page')).default;
  render(
    <MantineProvider theme={theme}>
      <CheckoutPage params={{ id }} />
    </MantineProvider>
  );
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /bayar/i })).toBeInTheDocument();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Checkout Page', () => {
  it('renders package summary with slot, site, animal type and price', async () => {
    await renderCheckout('pkg-1');

    expect(screen.getByText('Sisa slot: 80 lot')).toBeInTheDocument();
    expect(screen.getByText(/Kandang Sleman/)).toBeInTheDocument();
    expect(screen.getByText('KAMBING')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.000\.000/).length).toBeGreaterThan(0);
  });

  it('rejects lot count below 5 and disables payment', async () => {
    window.history.replaceState({}, '', '/app/checkout/pkg-1?mode=lot');
    await renderCheckout('pkg-1');

    const lotsInput = screen.getByLabelText('Jumlah lot');
    await userEvent.clear(lotsInput);
    await userEvent.type(lotsInput, '3');

    await waitFor(() => {
      expect(screen.getByText(/Minimal 5 lot/)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /bayar/i })).toBeDisabled();
  });

  it('enforces minimum checkout of Rp50.000', async () => {
    window.history.replaceState({}, '', '/app/checkout/pkg-2?mode=lot');
    await renderCheckout('pkg-2');

    const lotsInput = screen.getByLabelText('Jumlah lot');
    await userEvent.clear(lotsInput);
    await userEvent.type(lotsInput, '5');

    await waitFor(() => {
      expect(screen.getByText(/Minimum pembelian Rp50\.000/)).toBeInTheDocument();
    });
  });

  it('submits full ownership checkout with correct payload', async () => {
    await renderCheckout('pkg-3');

    await userEvent.click(screen.getByText('Beli penuh'));
    await userEvent.click(screen.getByRole('button', { name: /bayar/i }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        (call) =>
          String(call[0]).includes('/api/checkout') &&
          (call[1]?.method || 'GET').toUpperCase() === 'POST'
      );
      expect(post).toBeTruthy();
      expect(JSON.parse(String(post![1]?.body))).toEqual({
        packageId: 'pkg-3',
        ownershipType: 'FULL',
      });
    });
  });

  it('renders the sticky CTA and investment disclosure at mobile width', async () => {
    mediaMatches = true;
    await renderCheckout('pkg-1');

    const payButton = screen.getByRole('button', { name: /bayar/i });
    const stickyBar = payButton.closest('div');
    expect(stickyBar).not.toBeNull();
    expect(stickyBar).toHaveStyle({ position: 'fixed' });

    expect(
      screen.getByText('Nilai investasi dikembalikan di akhir periode sesuai realisasi ternak.')
    ).toBeInTheDocument();
  });
});
