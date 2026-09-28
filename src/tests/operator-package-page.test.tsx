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
    package: { findMany: ReturnType<typeof vi.fn> };
    siteProject: { findMany: ReturnType<typeof vi.fn> };
  },
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    package: { findMany: vi.fn() },
    siteProject: { findMany: vi.fn() },
  };
  state.prisma = prisma;
  return { prisma };
});

const packageRows = [
  {
    id: 'pkg-1',
    code: 'PCK-001',
    title: 'Paket Kambing Sleman',
    animalType: 'KAMBING',
    status: 'OPEN',
    price: 100000000,
    lotPrice: 1000000,
    totalLots: 100,
    soldLots: 20,
    periodMonths: 12,
    maxInvestors: 100,
    coverImage: null,
    description: null,
    createdAt: new Date(),
    siteProject: { id: 'sp-1', name: 'Kandang Sleman' },
  },
  {
    id: 'pkg-2',
    code: 'PCK-002',
    title: 'Paket Sapi Magelang',
    animalType: 'SAPI',
    status: 'DRAFT',
    price: 250000000,
    lotPrice: 2500000,
    totalLots: 100,
    soldLots: 0,
    periodMonths: 18,
    maxInvestors: 50,
    coverImage: null,
    description: null,
    createdAt: new Date(),
    siteProject: { id: 'sp-2', name: 'Kandang Magelang' },
  },
];

const siteRows = [
  {
    id: 'sp-1',
    name: 'Kandang Sleman',
    legalEntity: 'PT Sentosa',
    address: 'Jl. A',
    province: 'DI Yogyakarta',
    city: 'Sleman',
    capacity: 1500,
    status: 'ACTIVE',
  },
  {
    id: 'sp-2',
    name: 'Kandang Magelang',
    legalEntity: 'PT Maju',
    address: 'Jl. B',
    province: 'Jawa Tengah',
    city: 'Magelang',
    capacity: 900,
    status: 'ACTIVE',
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

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
  state.prisma.package.findMany.mockResolvedValue(packageRows);
  state.prisma.siteProject.findMany.mockResolvedValue(siteRows);

  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ id: 'pkg-new', code: 'PCK-9' }) };
    }
    if (method === 'PUT') {
      return { ok: true, status: 200, json: async () => ({ id: 'pkg-1' }) };
    }
    if (method === 'DELETE') {
      return { ok: true, status: 200, json: async () => ({ id: 'pkg-1' }) };
    }
    return { ok: true, status: 200, json: async () => ({ items: packageRows, total: packageRows.length }) };
  });
  vi.stubGlobal('fetch', fetchMock);
});

async function renderPage() {
  const Page = (await import('@/app/op/paket/page')).default;
  const tree = await Page();
  render(
    <MantineProvider theme={theme}>
      {tree}
    </MantineProvider>
  );
}

async function openCreateModal() {
  await userEvent.click(await screen.findByRole('button', { name: 'Tambah Paket' }));
  expect(await screen.findByRole('heading', { name: 'Tambah Paket' })).toBeInTheDocument();
}

async function fillInfoTab() {
  await userEvent.type(screen.getByLabelText('Kode paket'), 'PCK-9');
  await userEvent.type(screen.getByLabelText('Judul paket'), 'Paket Kambing Baru');

  const siteInput = screen.getByLabelText('Site project');
  await userEvent.click(siteInput);
  await userEvent.type(siteInput, 'Sleman');
  await userEvent.click(await screen.findByRole('option', { name: 'Kandang Sleman' }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Operator Paket page', () => {
  it('menampilkan daftar paket dan memfilter lewat pencarian', async () => {
    await renderPage();

    expect(await screen.findByText('Paket Kambing Sleman')).toBeInTheDocument();
    expect(screen.getByText('Paket Sapi Magelang')).toBeInTheDocument();

    const search = screen.getByLabelText('Cari data');
    await userEvent.type(search, 'Magelang');

    await waitFor(
      () => {
        expect(screen.getByText('Paket Sapi Magelang')).toBeInTheDocument();
        expect(screen.queryByText('Paket Kambing Sleman')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('membuka modal bertab dan menyimpan paket dengan status serta total lot', async () => {
    await renderPage();
    await openCreateModal();

    // Semua tab tampil
    expect(screen.getByRole('tab', { name: 'Info' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ternak' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Biaya' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Return' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Media' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Jadwal' })).toBeInTheDocument();

    await fillInfoTab();

    // Status = OPEN di tab Info
    const statusSelect = screen.getByLabelText('Status paket');
    await userEvent.click(statusSelect);
    await userEvent.click(await screen.findByRole('option', { name: 'OPEN' }));

    // Tab Return: harga → total lot terhitung otomatis
    await userEvent.click(screen.getByRole('tab', { name: 'Return' }));
    await userEvent.type(screen.getByLabelText('Harga paket'), '100000000');
    await userEvent.type(screen.getByLabelText('Harga per lot'), '1000000');
    expect(screen.getByText('Total lot: 100')).toBeInTheDocument();

    // Tab Biaya: isi satu komponen biaya
    await userEvent.click(screen.getByRole('tab', { name: 'Biaya' }));
    const amountInput = screen.getByLabelText('Jumlah biaya');
    await userEvent.type(amountInput, '50000000');

    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/admin/packages',
          expect.objectContaining({ method: 'POST' })
        );
      },
      { timeout: 3000 }
    );

    const postCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST'
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.code).toBe('PCK-9');
    expect(body.status).toBe('OPEN');
    expect(body.totalLots).toBe(100);
    expect(body.siteProjectId).toBe('sp-1');
    expect(body.costs.length).toBeGreaterThan(0);
    expect(body.costs[0].amount).toBe(50000000);
  });

  it('menghitung total lot secara langsung saat harga diubah', async () => {
    await renderPage();
    await openCreateModal();

    await userEvent.click(screen.getByRole('tab', { name: 'Return' }));
    await userEvent.type(screen.getByLabelText('Harga paket'), '250000000');
    await userEvent.type(screen.getByLabelText('Harga per lot'), '5000000');

    expect(screen.getByText('Total lot: 50')).toBeInTheDocument();
  });
});
