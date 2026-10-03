import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { theme } from '@/theme/theme';

process.env.AUTH_SECRET ||= 'test-secret-for-vitest';

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const signInMock = vi.hoisted(() => vi.fn());

vi.mock('next-auth/react', () => ({ signIn: signInMock }));

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));

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
      undefined as unknown as Parameters<typeof middleware>[1]
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

// ---------------------------------------------------------------------------
// Halaman Login
// ---------------------------------------------------------------------------

describe('halaman login', () => {
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
    signInMock.mockReset();
    routerMock.push.mockReset();
    routerMock.refresh.mockReset();
  });

  async function renderLogin() {
    const { default: LoginPage } = await import('@/app/(auth)/login/page');
    return render(createElement(MantineProvider, { theme }, createElement(LoginPage)));
  }

  it('memasang atribut form untuk password manager dan autoFocus', async () => {
    await renderLogin();

    const identifier = screen.getByLabelText(/email atau username/i);
    expect(identifier).toHaveAttribute('name', 'identifier');
    expect(identifier).toHaveAttribute('autocomplete', 'username');
    expect(identifier).toHaveFocus();

    const password = screen.getByLabelText(/^password/i);
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
  });

  it('tombol toggle mengubah tipe input password dari password ke text', async () => {
    const user = userEvent.setup();
    await renderLogin();

    const password = screen.getByLabelText(/^password/i);
    expect(password).toHaveAttribute('type', 'password');

    const showButton = screen.getByRole('button', { name: /tampilkan kata sandi/i });
    expect(showButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(showButton);

    expect(password).toHaveAttribute('type', 'text');
    const hideButton = screen.getByRole('button', { name: /sembunyikan kata sandi/i });
    expect(hideButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('menampilkan error server lewat Alert dan memfokuskan field identifier', async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue({ error: 'CredentialsSignin' });
    await renderLogin();

    const identifier = screen.getByLabelText(/email atau username/i);
    await user.type(identifier, 'budi@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^masuk$/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email\/username atau password salah/i);
    expect(alert).toHaveAttribute('aria-live', 'polite');

    await waitFor(() => {
      expect(identifier).toHaveFocus();
    });
    expect(identifier).toHaveAttribute('aria-invalid', 'true');
    expect(identifier).toHaveAttribute('aria-describedby');
  });
});
