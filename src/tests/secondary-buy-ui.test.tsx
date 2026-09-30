import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { theme } from '@/theme/theme';

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

const listing = {
  id: 'listing-1',
  listingPrice: 2500000,
  expiresAt: '2026-12-31T00:00:00.000Z',
  listedAt: '2026-09-01T00:00:00.000Z',
  status: 'ACTIVE',
  isMine: false,
  ownershipType: 'FULL' as const,
  lotStart: null,
  lotEnd: null,
  seller: { id: 'user-2', username: 'budi', name: 'Budi Santoso' },
  package: {
    id: 'pkg-1',
    code: 'PCK-001',
    title: 'Paket Kambing Etawa Sleman',
    price: 100000000,
    animalType: 'KAMBING',
    siteProject: { name: 'Kandang Sleman' },
  },
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function makeFetch(buyResponse: () => unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url.includes('/api/secondary/buy')) {
      return buyResponse();
    }

    if (url.includes('/api/secondary')) {
      return jsonResponse(200, { listings: [listing], myAssets: [], listingDays: 7 });
    }

    throw new Error(`Unhandled fetch in test: ${method} ${url}`);
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  routerMock.push.mockReset();
  routerMock.replace.mockReset();
  routerMock.refresh.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderPage(buyResponse: () => unknown) {
  fetchMock = makeFetch(buyResponse);
  vi.stubGlobal('fetch', fetchMock);

  const SecondaryPage = (await import('@/app/app/secondary/page')).default;
  render(
    <MantineProvider theme={theme}>
      <SecondaryPage />
    </MantineProvider>
  );

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Beli' })).toBeInTheDocument();
  });
}

async function openAndConfirm() {
  await userEvent.click(screen.getByRole('button', { name: 'Beli' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Konfirmasi beli' }));
}

describe('Secondary buy UI', () => {
  it('navigates to the payment redirectUrl returned by POST /api/secondary/buy', async () => {
    const redirectUrl = 'https://app.sandbox.midtrans.com/snap/v2/vtweb/abc/token';
    await renderPage(() =>
      jsonResponse(200, {
        orderId: 'SEC-1',
        snapToken: 'snap-token-1',
        redirectUrl,
        total: 2500000,
        simulate: false,
      })
    );

    await openAndConfirm();

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        (call) =>
          String(call[0]).includes('/api/secondary/buy') &&
          (call[1]?.method || 'GET').toUpperCase() === 'POST'
      );
      expect(post).toBeTruthy();
      expect(JSON.parse(String(post![1]?.body))).toEqual({ listingId: 'listing-1' });
    });

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith(redirectUrl);
    });
  });

  it('navigates to the internal simulation page in simulate mode', async () => {
    await renderPage(() =>
      jsonResponse(200, {
        orderId: 'SEC-42',
        snapToken: null,
        redirectUrl: '/app/bayar-simulasi/SEC-42',
        total: 2500000,
        simulate: true,
      })
    );

    await openAndConfirm();

    await waitFor(() => {
      expect(routerMock.push).toHaveBeenCalledWith('/app/bayar-simulasi/SEC-42');
    });
  });

  it('shows the Indonesian error message and does not navigate on a non-ok response', async () => {
    await renderPage(() =>
      jsonResponse(409, { error: 'Listing sudah tidak aktif' })
    );

    await openAndConfirm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Listing sudah tidak aktif');
    });

    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
