import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/prisma';
import { theme } from '@/theme/theme';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({
  prisma: {} as {
    siteProject: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    package: { count: ReturnType<typeof vi.fn> };
    user: { count: ReturnType<typeof vi.fn> };
    livestock: { count: ReturnType<typeof vi.fn> };
  },
  auth: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    siteProject: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    package: { count: vi.fn() },
    user: { count: vi.fn() },
    livestock: { count: vi.fn() },
  };
  state.prisma = prisma;
  return { prisma };
});

vi.mock('@/lib/auth', () => {
  class AuthenticationError extends Error {
    readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';

    constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
      super(code);
      this.name = 'AuthenticationError';
      this.code = code;
    }
  }

  const operator = {
    id: 'op-1',
    role: 'OPERATOR',
    username: 'operator_utama',
    kycStatus: 'VERIFIED',
  };

  return {
    AuthenticationError,
    requireRole: vi.fn(async () => operator),
    getCurrentUser: vi.fn(async () => operator),
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/op',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

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
    writable: true,
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
  vi.clearAllMocks();
  state.prisma.siteProject.findMany.mockResolvedValue([]);
  state.prisma.siteProject.findFirst.mockResolvedValue(null);
  state.prisma.siteProject.create.mockResolvedValue({ id: 'sp-9' });
  state.prisma.siteProject.delete.mockResolvedValue({ id: 'sp-1' });
  state.prisma.package.count.mockResolvedValue(0);
});

const validBody = {
  name: 'Peternakan Sentosa',
  legalEntity: 'PT Sentosa Nusantara',
  address: 'Jl. Raya Solo KM 12',
  province: 'Jawa Tengah',
  city: 'Surakarta',
  capacity: 1500,
  status: 'ACTIVE',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Operator layout', () => {
  it('menampilkan navigasi operator dan tombol keluar', async () => {
    const { default: OperatorLayout } = await import('@/app/op/layout');
    const ui = await OperatorLayout({ children: <div>Konten halaman</div> });
    render(<MantineProvider theme={theme}>{ui}</MantineProvider>);

    expect(screen.getByRole('link', { name: 'Beranda' })).toHaveAttribute('href', '/op');
    expect(screen.getByRole('link', { name: 'Site Project' })).toHaveAttribute(
      'href',
      '/op/site-projects'
    );
    expect(screen.getByRole('link', { name: 'Paket' })).toHaveAttribute('href', '/op/paket');
    expect(screen.getByRole('link', { name: 'Ternak' })).toHaveAttribute('href', '/op/ternak');
    expect(screen.getByRole('link', { name: 'Profit' })).toHaveAttribute('href', '/op/profit');
    expect(screen.getByRole('link', { name: "Ta'awun" })).toHaveAttribute('href', '/op/taawun');
    expect(screen.getByRole('link', { name: 'Secondary' })).toHaveAttribute(
      'href',
      '/op/secondary'
    );
    expect(screen.getByRole('link', { name: 'Pengaturan' })).toHaveAttribute(
      'href',
      '/op/settings'
    );
    expect(screen.getByRole('button', { name: 'Keluar' })).toBeInTheDocument();
  });
});

describe('API site projects', () => {
  it('GET menyaring berdasarkan q pada nama dan badan usaha', async () => {
    state.prisma.siteProject.findMany.mockResolvedValue([
      { id: 'sp-1', name: 'Peternakan Sentosa' },
    ]);
    state.prisma.siteProject.count.mockResolvedValue(1);

    const { GET } = await import('@/app/api/admin/site-projects/route');
    const res = await GET(
      new NextRequest('http://localhost:3000/api/admin/site-projects?q=sentosa')
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [{ id: 'sp-1', name: 'Peternakan Sentosa' }],
      total: 1,
    });

    const arg = state.prisma.siteProject.findMany.mock.calls[0][0];
    expect(arg.where.OR).toEqual([
      { name: { contains: 'sentosa', mode: 'insensitive' } },
      { legalEntity: { contains: 'sentosa', mode: 'insensitive' } },
    ]);
  });

  it('POST menolak badan usaha ganda dengan 409', async () => {
    state.prisma.siteProject.findFirst.mockResolvedValue({ id: 'sp-1' });

    const { POST } = await import('@/app/api/admin/site-projects/route');
    const res = await POST(
      new NextRequest('http://localhost:3000/api/admin/site-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      })
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Badan usaha sudah terdaftar.' });
  });

  it('POST membuat site project baru dengan 201', async () => {
    state.prisma.siteProject.findFirst.mockResolvedValue(null);
    state.prisma.siteProject.create.mockResolvedValue({ id: 'sp-9', name: validBody.name });

    const { POST } = await import('@/app/api/admin/site-projects/route');
    const res = await POST(
      new NextRequest('http://localhost:3000/api/admin/site-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      })
    );

    expect(res.status).toBe(201);
    expect(state.prisma.siteProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: validBody.name,
          capacity: validBody.capacity,
          status: validBody.status,
        }),
      })
    );
  });

  it('DELETE menolak site yang masih memiliki paket', async () => {
    state.prisma.siteProject.findFirst.mockResolvedValue({ id: 'sp-1' });
    state.prisma.package.count.mockResolvedValue(2);

    const { DELETE } = await import('@/app/api/admin/site-projects/route');
    const res = await DELETE(
      new NextRequest('http://localhost:3000/api/admin/site-projects?id=sp-1', {
        method: 'DELETE',
      })
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Site masih memiliki paket aktif.' });
  });
});
