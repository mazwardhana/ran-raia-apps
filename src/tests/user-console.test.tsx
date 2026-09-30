import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { theme } from '@/theme/theme';

// ---------------------------------------------------------------------------
// Mock prisma + auth — dipakai oleh tes API (GET/PATCH).
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('@/lib/auth', () => {
  class AuthenticationError extends Error {
    readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';

    constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
      super(code === 'UNAUTHENTICATED' ? 'Authentication required' : 'Insufficient role');
      this.name = 'AuthenticationError';
      this.code = code;
    }
  }

  return {
    AuthenticationError,
    requireRole: vi.fn(),
    getCurrentUser: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Data contoh
// ---------------------------------------------------------------------------

const users = [
  {
    id: 'u1',
    username: 'budi',
    name: 'Budi Santoso',
    email: 'budi@example.com',
    role: 'INVESTOR',
    kycStatus: 'PENDING',
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    username: 'sari',
    name: 'Sari Dewi',
    email: 'sari@example.com',
    role: 'OPERATOR',
    kycStatus: 'VERIFIED',
    createdAt: '2026-09-02T00:00:00.000Z',
  },
  {
    id: 'u3',
    username: 'agus',
    name: 'Agus Salim',
    email: 'agus@example.com',
    role: 'ADMIN',
    kycStatus: 'REJECTED',
    createdAt: '2026-09-03T00:00:00.000Z',
  },
];

const operator = {
  id: 'op_1',
  role: 'OPERATOR',
  username: 'operator',
  kycStatus: 'VERIFIED',
};

const admin = { ...operator, id: 'ad_1', role: 'ADMIN', username: 'admin' };

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
      return jsonResponse(200, { user: users[0] });
    }
    if (url.includes('/api/admin/users')) {
      return jsonResponse(200, payload);
    }
    throw new Error(`Unhandled fetch in test: ${method} ${url}`);
  });
}

function makeFailingFetch() {
  return vi.fn(async () => jsonResponse(500, { error: 'boom' }));
}

function mockAuthAs(user: typeof operator) {
  return async (roles: string | string[]) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    const { AuthenticationError } = await import('@/lib/auth');
    if (!allowed.includes(user.role)) throw new AuthenticationError('FORBIDDEN');
    return user;
  };
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

beforeEach(async () => {
  vi.clearAllMocks();
  fetchMock = makeFetch({ users });
  vi.stubGlobal('fetch', fetchMock);

  const { requireRole } = await import('@/lib/auth');
  vi.mocked(requireRole).mockImplementation(mockAuthAs(operator));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderConsole(
  role: 'ADMIN' | 'OPERATOR' = 'OPERATOR',
  fetchImpl?: ReturnType<typeof vi.fn>
) {
  if (fetchImpl) {
    fetchMock = fetchImpl;
    vi.stubGlobal('fetch', fetchImpl);
  }
  const { UserConsole } = await import('@/app/op/pengguna/UserConsole');
  render(
    <MantineProvider theme={theme}>
      <UserConsole sessionRole={role} />
    </MantineProvider>
  );
}

// ---------------------------------------------------------------------------
// API — GET /api/admin/users
// ---------------------------------------------------------------------------

describe('GET /api/admin/users', () => {
  it('mengembalikan daftar pengguna tanpa akun SYSTEM, urut createdAt desc', async () => {
    prismaMock.user.findMany.mockResolvedValue(users);

    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/users'));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.users).toHaveLength(3);
    expect(json.users[0]).toMatchObject({
      id: 'u1',
      username: 'budi',
      role: 'INVESTOR',
      kycStatus: 'PENDING',
    });

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { not: 'SYSTEM' } },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('menerapkan filter ?search ke username/name/email (case-insensitive)', async () => {
    prismaMock.user.findMany.mockResolvedValue([users[0]]);

    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(
      new NextRequest('http://localhost/api/admin/users?search=budi')
    );

    expect(res.status).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: { not: 'SYSTEM' },
          OR: [
            { username: { contains: 'budi', mode: 'insensitive' } },
            { name: { contains: 'budi', mode: 'insensitive' } },
            { email: { contains: 'budi', mode: 'insensitive' } },
          ],
        },
      })
    );
  });

  it('menolak pengguna yang belum login dengan 401', async () => {
    const { requireRole, AuthenticationError } = await import('@/lib/auth');
    vi.mocked(requireRole).mockRejectedValue(
      new AuthenticationError('UNAUTHENTICATED')
    );

    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/users'));

    expect(res.status).toBe(401);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('menolak peran yang tidak berhak dengan 403', async () => {
    const { requireRole, AuthenticationError } = await import('@/lib/auth');
    vi.mocked(requireRole).mockRejectedValue(new AuthenticationError('FORBIDDEN'));

    const { GET } = await import('@/app/api/admin/users/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/users'));

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// API — PATCH /api/admin/users/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/users/[id]', () => {
  function patchRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/admin/users/u1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  const params = { params: { id: 'u1' } };

  it('ADMIN boleh mengubah role dan kycStatus (200)', async () => {
    const { requireRole } = await import('@/lib/auth');
    vi.mocked(requireRole).mockImplementation(mockAuthAs(admin));
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: 'INVESTOR' });
    prismaMock.user.update.mockResolvedValue({ ...users[0], role: 'OPERATOR' });

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const res = await PATCH(patchRequest({ role: 'OPERATOR' }), params);

    expect(res.status).toBe(200);
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['ADMIN']);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ role: 'OPERATOR' }),
      })
    );
  });

  it('OPERATOR ditolak 403 saat mengubah role', async () => {
    const { requireRole } = await import('@/lib/auth');
    vi.mocked(requireRole).mockImplementation(mockAuthAs(operator));
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: 'INVESTOR' });

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const res = await PATCH(patchRequest({ role: 'ADMIN' }), params);

    expect(res.status).toBe(403);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('OPERATOR boleh mengubah kycStatus (200)', async () => {
    const { requireRole } = await import('@/lib/auth');
    vi.mocked(requireRole).mockImplementation(mockAuthAs(operator));
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', role: 'INVESTOR' });
    prismaMock.user.update.mockResolvedValue({ ...users[0], kycStatus: 'VERIFIED' });

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const res = await PATCH(patchRequest({ kycStatus: 'VERIFIED' }), params);

    expect(res.status).toBe(200);
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['ADMIN', 'OPERATOR']);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ kycStatus: 'VERIFIED' }),
      })
    );
  });

  it('menolak role SYSTEM lewat API dengan 400', async () => {
    const { requireRole } = await import('@/lib/auth');
    vi.mocked(requireRole).mockImplementation(mockAuthAs(admin));

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const res = await PATCH(patchRequest({ role: 'SYSTEM' }), params);

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('menolak kycStatus tidak dikenal dengan 400', async () => {
    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const res = await PATCH(patchRequest({ kycStatus: 'SUSPENDED' }), params);

    expect(res.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('menolak mengubah akun SYSTEM dengan 404', async () => {
    const { requireRole } = await import('@/lib/auth');
    vi.mocked(requireRole).mockImplementation(mockAuthAs(admin));
    prismaMock.user.findUnique.mockResolvedValue({ id: 'sys', role: 'SYSTEM' });

    const { PATCH } = await import('@/app/api/admin/users/[id]/route');
    const res = await PATCH(patchRequest({ kycStatus: 'VERIFIED' }), {
      params: { id: 'sys' },
    });

    expect([403, 404]).toContain(res.status);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UI — UserConsole
// ---------------------------------------------------------------------------

describe('Konsol pengguna operator', () => {
  it('memuat pengguna dari GET /api/admin/users dan menampilkannya', async () => {
    await renderConsole('OPERATOR');

    expect(await screen.findByText('@budi')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('budi@example.com')).toBeInTheDocument();
    expect(screen.getByText('@sari')).toBeInTheDocument();
    expect(screen.getByText('@agus')).toBeInTheDocument();

    expect(screen.getByText('Menunggu')).toBeInTheDocument();
    expect(screen.getByText('Terverifikasi')).toBeInTheDocument();
    expect(screen.getByText('Ditolak')).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users');
  });

  it('menampilkan loading state saat data sedang dimuat', async () => {
    const pending = vi.fn(() => new Promise(() => {}));
    await renderConsole('OPERATOR', pending);

    expect(screen.getByText('Memuat daftar pengguna...')).toBeInTheDocument();
  });

  it('memfilter baris yang terlihat lewat pencarian', async () => {
    await renderConsole('OPERATOR');
    await screen.findByText('@budi');

    await userEvent.type(screen.getByLabelText('Cari pengguna'), 'sari');

    await waitFor(() => {
      expect(screen.getByText('@sari')).toBeInTheDocument();
      expect(screen.queryByText('@budi')).not.toBeInTheDocument();
      expect(screen.queryByText('@agus')).not.toBeInTheDocument();
    });
  });

  it('menampilkan empty state saat tidak ada pengguna', async () => {
    await renderConsole('OPERATOR', makeFetch({ users: [] }));

    expect(
      await screen.findByText('Belum ada pengguna')
    ).toBeInTheDocument();
  });

  it('menampilkan error state saat pengambilan data gagal', async () => {
    const failing = makeFailingFetch();
    await renderConsole('OPERATOR', failing);

    expect(
      await screen.findByText('Gagal memuat daftar pengguna')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    await waitFor(() => {
      expect(failing).toHaveBeenCalledTimes(2);
    });
  });

  it('ADMIN dapat mengubah kycStatus lewat PATCH', async () => {
    await renderConsole('ADMIN');
    await screen.findByText('@budi');

    const row = screen.getByText('@budi').closest('tr') as HTMLTableRowElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Ubah' }));

    await userEvent.click(await screen.findByLabelText('Status KYC'));
    await userEvent.click(await screen.findByRole('option', { name: 'Terverifikasi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH'
      );
      expect(patch).toBeTruthy();
      expect(String(patch![0])).toBe('/api/admin/users/u1');
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({
        kycStatus: 'VERIFIED',
      });
    });
  });

  it('ADMIN dapat mengubah role lewat PATCH', async () => {
    await renderConsole('ADMIN');
    await screen.findByText('@budi');

    const row = screen.getByText('@budi').closest('tr') as HTMLTableRowElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Ubah' }));

    const roleSelect = await screen.findByLabelText('Role');
    expect(roleSelect).not.toBeDisabled();
    await userEvent.click(roleSelect);
    await userEvent.click(await screen.findByRole('option', { name: 'OPERATOR' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH'
      );
      expect(patch).toBeTruthy();
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({
        role: 'OPERATOR',
      });
    });
  });

  it('OPERATOR tidak dapat mengubah role (select nonaktif) tetapi bisa ubah kycStatus', async () => {
    await renderConsole('OPERATOR');
    await screen.findByText('@budi');

    const row = screen.getByText('@budi').closest('tr') as HTMLTableRowElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Ubah' }));

    expect(await screen.findByLabelText('Role')).toBeDisabled();

    await userEvent.click(screen.getByLabelText('Status KYC'));
    await userEvent.click(await screen.findByRole('option', { name: 'Terverifikasi' }));
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === 'PATCH'
      );
      expect(patch).toBeTruthy();
      expect(JSON.parse(String((patch![1] as RequestInit).body))).toEqual({
        kycStatus: 'VERIFIED',
      });
    });
  });
});
