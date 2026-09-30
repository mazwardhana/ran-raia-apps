import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { theme } from '@/theme/theme';

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

const myListing = {
  id: 'listing-1',
  listingPrice: 2500000,
  expiresAt: '2026-12-31T00:00:00.000Z',
  listedAt: '2026-09-01T00:00:00.000Z',
  status: 'ACTIVE',
  isMine: true,
  ownershipType: 'FULL' as const,
  lotStart: null,
  lotEnd: null,
  seller: { id: 'user-1', username: 'budi', name: 'Budi Santoso' },
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

function makeFetch(deleteResponse: () => unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url.includes('/api/secondary/listing-1') && method === 'DELETE') {
      return deleteResponse();
    }

    if (url.includes('/api/secondary')) {
      return jsonResponse(200, {
        listings: [myListing],
        myAssets: [],
        listingDays: 7,
      });
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

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderPage(deleteResponse: () => unknown) {
  const fetchMock = makeFetch(deleteResponse);
  vi.stubGlobal('fetch', fetchMock);

  const SecondaryPage = (await import('@/app/app/secondary/page')).default;
  render(
    <MantineProvider theme={theme}>
      <SecondaryPage />
    </MantineProvider>
  );

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Batalkan' })).toBeInTheDocument();
  });

  return fetchMock;
}

describe('Secondary cancel UI', () => {
  it('mengirim DELETE ke /api/secondary/[id] lalu memuat ulang daftar', async () => {
    const fetchMock = await renderPage(() => jsonResponse(200, { success: true }));

    await userEvent.click(screen.getByRole('button', { name: 'Batalkan' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Konfirmasi batalkan' })
    );

    await waitFor(() => {
      const del = fetchMock.mock.calls.find(
        (call) =>
          String(call[0]).includes('/api/secondary/listing-1') &&
          (call[1]?.method || 'GET').toUpperCase() === 'DELETE'
      );
      expect(del).toBeTruthy();
    });

    // Modal tertutup dan daftar dimuat ulang (GET /api/secondary dipanggil dua kali).
    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        (call) =>
          String(call[0]).endsWith('/api/secondary') &&
          (call[1]?.method || 'GET').toUpperCase() === 'GET'
      );
      expect(getCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('menampilkan pesan galat Indonesia di modal saat 409', async () => {
    await renderPage(() =>
      jsonResponse(409, { error: 'Listing tidak bisa dibatalkan' })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Batalkan' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Konfirmasi batalkan' })
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Listing tidak bisa dibatalkan'
      );
    });
  });
});
