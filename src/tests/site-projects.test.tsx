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
  prisma: {} as { siteProject: { findMany: ReturnType<typeof vi.fn> } },
}));

vi.mock('@/lib/prisma', () => {
  const prisma = { siteProject: { findMany: vi.fn() } };
  state.prisma = prisma;
  return { prisma };
});

const rows = [
  {
    id: 'sp-1',
    code: 'SP-01',
    name: 'Peternakan Sentosa',
    legalEntity: 'PT Sentosa',
    address: 'Jl. A',
    province: 'Jawa Tengah',
    city: 'Surakarta',
    capacity: 1500,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sp-2',
    code: 'SP-02',
    name: 'Kandang Maju',
    legalEntity: 'PT Maju',
    address: 'Jl. B',
    province: 'DI Yogyakarta',
    city: 'Sleman',
    capacity: 800,
    status: 'NONAKTIF',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

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

beforeEach(() => {
  state.prisma.siteProject.findMany.mockResolvedValue(rows);

  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'POST') {
      return {
        ok: true,
        status: 201,
        json: async () => ({ siteProject: { id: 'sp-9' } }),
      } as Response;
    }
    if (method === 'PUT') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ siteProject: { id: 'sp-1' } }),
      } as Response;
    }
    if (method === 'DELETE') {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ items: rows, total: rows.length }),
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
});

async function renderPage() {
  const Page = (await import('@/app/op/site-projects/page')).default;
  const tree = await Page();
  render(
    <MantineProvider theme={theme}>
      {tree}
    </MantineProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Operator Site Project page', () => {
  it('menampilkan semua site project dan memfilter lewat pencarian', async () => {
    await renderPage();

    expect(await screen.findByText('Peternakan Sentosa')).toBeInTheDocument();
    expect(screen.getByText('Kandang Maju')).toBeInTheDocument();

    const search = screen.getByLabelText('Cari data');
    await userEvent.type(search, 'Maju');

    await waitFor(
      () => {
        expect(screen.getByText('Kandang Maju')).toBeInTheDocument();
        expect(screen.queryByText('Peternakan Sentosa')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('membuat site project baru lewat modal', async () => {
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Tambah Site Project' }));
    expect(await screen.findByRole('heading', { name: 'Tambah Site Project' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Nama site'), 'Peternakan Baru');
    await userEvent.type(screen.getByLabelText('Badan usaha (PT)'), 'PT Baru');
    await userEvent.type(screen.getByLabelText('Alamat'), 'Jl. Baru No. 1');
    await userEvent.type(screen.getByLabelText('Kabupaten/Kota'), 'Semarang');
    await userEvent.type(screen.getByLabelText('Kapasitas (ekor)'), '1500');

    // Provinsi: SearchableSelect — klik, ketik, pilih opsi
    const provinceInput = screen.getByLabelText('Provinsi');
    await userEvent.click(provinceInput);
    await userEvent.type(provinceInput, 'Jawa');
    const option = await screen.findByText('Jawa Tengah');
    await userEvent.click(option);

    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/admin/site-projects',
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
    expect(body.name).toBe('Peternakan Baru');
    expect(body.capacity).toBe(1500);
  });

  it('menyaring baris lewat filter status', async () => {
    await renderPage();

    expect(await screen.findByText('Peternakan Sentosa')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Status'));
    await userEvent.click(await screen.findByRole('option', { name: 'NONAKTIF' }));

    await waitFor(() => {
      expect(screen.getByText('Kandang Maju')).toBeInTheDocument();
      expect(screen.queryByText('Peternakan Sentosa')).not.toBeInTheDocument();
    });
  });
});
