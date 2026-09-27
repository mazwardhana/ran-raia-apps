import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

process.env.AUTH_SECRET ||= 'test-secret-for-vitest';

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

describe('registration', () => {
  afterEach(() => vi.clearAllMocks());

  it('registration creates user with unique username', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      username: 'budi_investor',
      email: 'budi@example.com',
      name: 'Budi Investor',
      role: 'INVESTOR',
      kycStatus: 'PENDING',
    });

    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Budi Investor',
        username: 'budi_investor',
        email: 'budi@example.com',
        password: 'password123',
        phone: '081234567890',
      }),
    }));

    expect(response.status).toBe(201);
    expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        username: 'budi_investor',
        kycStatus: 'PENDING',
      }),
    }));
  });

  it('registration rejects duplicate username case-insensitive', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'existing-user' });

    const { POST } = await import('@/app/api/auth/register/route');
    const response = await POST(new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Budi Lain',
        username: 'BUDI_INVESTOR',
        email: 'lain@example.com',
        password: 'password123',
        phone: '081234567891',
      }),
    }));

    expect(response.status).toBe(409);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});

describe('route protection', () => {
  it('middleware redirects unauthenticated user to /login', async () => {
    const { middleware } = await import('@/middleware');
    const response = await middleware(
      new NextRequest('http://localhost/app'),
      undefined as Parameters<typeof middleware>[1]
    );

    expect(response?.headers.get('location')).toBe('http://localhost/login');
  });

  it('investor with KYC PENDING redirected from /app/checkout', async () => {
    const { getRouteRedirect } = await import('@/middleware');
    const redirect = getRouteRedirect('/app/checkout/package-1', {
      user: { id: 'user-1', role: 'INVESTOR', kycStatus: 'PENDING' },
    });

    expect(redirect).toBe('/kyc');
  });
});
