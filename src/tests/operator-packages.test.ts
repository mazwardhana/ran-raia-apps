import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMock = vi.hoisted(() => ({
  package: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  packageCost: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
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

const operator = {
  id: 'user-op-1',
  role: 'OPERATOR',
  username: 'operator_satu',
  kycStatus: 'VERIFIED',
};

const validBody = {
  code: 'PKG-001',
  status: 'DRAFT',
  title: 'Paket Sapi Etawa',
  animalType: 'SAPI',
  siteProjectId: 'site_1',
  periodMonths: 12,
  price: 18000000,
  lotPrice: 10000,
  totalLots: 1800,
  maxInvestors: 50,
  description: 'Paket uji coba',
  costs: [
    { costType: 'ANIMAL', amount: 10000000, description: 'Bibit sapi' },
    { costType: 'FEED', amount: 2000000, description: 'Pakan' },
  ],
};

describe('operator packages API', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireRole } = await import('@/lib/auth');
    vi.mocked(requireRole).mockResolvedValue(operator);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns items+total with q filter applied', async () => {
    prismaMock.package.findMany.mockResolvedValue([
      { id: 'p1', code: 'PKG-001', title: 'Paket Sapi Etawa' },
    ]);
    prismaMock.package.count.mockResolvedValue(1);

    const { GET } = await import('@/app/api/admin/packages/route');
    const response = await GET(
      new NextRequest('http://localhost/api/admin/packages?q=sapi&page=2&pageSize=5')
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.total).toBe(1);
    expect(json.page).toBe(2);
    expect(json.pageSize).toBe(5);
    expect(prismaMock.package.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { title: { contains: 'sapi', mode: 'insensitive' } },
            { code: { contains: 'sapi', mode: 'insensitive' } },
          ],
        }),
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
        select: expect.objectContaining({
          siteProject: { select: { id: true, name: true } },
        }),
      })
    );
  });

  it('POST with invalid payload returns 400 with Indonesian error', async () => {
    const { POST } = await import('@/app/api/admin/packages/route');
    const response = await POST(
      new NextRequest('http://localhost/api/admin/packages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...validBody, title: 'X' }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Nama paket wajib diisi');
    expect(prismaMock.package.create).not.toHaveBeenCalled();
  });

  it('POST valid payload creates package with nested costs', async () => {
    prismaMock.package.findFirst.mockResolvedValue(null);
    prismaMock.package.create.mockResolvedValue({
      id: 'p1',
      code: 'PKG-001',
      title: 'Paket Sapi Etawa',
    });

    const { POST } = await import('@/app/api/admin/packages/route');
    const response = await POST(
      new NextRequest('http://localhost/api/admin/packages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual({ id: 'p1', code: 'PKG-001', title: 'Paket Sapi Etawa' });
    expect(prismaMock.package.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'PKG-001',
          title: 'Paket Sapi Etawa',
          status: 'DRAFT',
          costs: {
            create: [
              expect.objectContaining({ costType: 'ANIMAL', amount: 10000000 }),
              expect.objectContaining({ costType: 'FEED', amount: 2000000 }),
            ],
          },
        }),
      })
    );
  });

  it('POST duplicate code returns 409', async () => {
    prismaMock.package.findFirst.mockResolvedValue({ id: 'existing' });

    const { POST } = await import('@/app/api/admin/packages/route');
    const response = await POST(
      new NextRequest('http://localhost/api/admin/packages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe('Kode paket sudah digunakan.');
    expect(prismaMock.package.create).not.toHaveBeenCalled();
  });

  it('DELETE non-DRAFT package returns 409', async () => {
    prismaMock.package.findUnique.mockResolvedValue({ id: 'p1', status: 'OPEN' });

    const { DELETE } = await import('@/app/api/admin/packages/route');
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/packages?id=p1', { method: 'DELETE' })
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe('Hanya paket berstatus Draf yang dapat dihapus.');
    expect(prismaMock.package.delete).not.toHaveBeenCalled();
  });

  it('DELETE DRAFT package succeeds', async () => {
    prismaMock.package.findUnique.mockResolvedValue({ id: 'p1', status: 'DRAFT' });
    prismaMock.package.delete.mockResolvedValue({ id: 'p1' });

    const { DELETE } = await import('@/app/api/admin/packages/route');
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/packages?id=p1', { method: 'DELETE' })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.package.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('returns 401 when user is unauthenticated', async () => {
    const { requireRole, AuthenticationError } = await import('@/lib/auth');
    vi.mocked(requireRole).mockRejectedValue(
      new AuthenticationError('UNAUTHENTICATED')
    );

    const { GET } = await import('@/app/api/admin/packages/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/packages'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(typeof json.error).toBe('string');
  });

  it('returns 403 when role is forbidden', async () => {
    const { requireRole, AuthenticationError } = await import('@/lib/auth');
    vi.mocked(requireRole).mockRejectedValue(new AuthenticationError('FORBIDDEN'));

    const { POST } = await import('@/app/api/admin/packages/route');
    const response = await POST(
      new NextRequest('http://localhost/api/admin/packages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validBody),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(typeof json.error).toBe('string');
  });
});
