import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signIn } from 'next-auth/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { theme } from '@/theme/theme';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
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
  vi.clearAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
  global.fetch = fetch;
});

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

describe('Registration, Login, and KYC Flow', () => {
  it('register form shows username uniqueness validation error from server 409', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Username atau email sudah digunakan' }),
    });

    const { default: RegisterPage } = await import('@/app/(public)/register/page');
    renderWithTheme(<RegisterPage />);

    await user.type(screen.getByLabelText(/nama/i), 'Budi Santoso');
    await user.type(screen.getByLabelText(/username/i), 'budi_investor');
    await user.type(screen.getByLabelText(/email/i), 'budi@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/telepon/i), '081234567890');

    const submitButton = screen.getByRole('button', { name: /daftar/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/username atau email sudah digunakan/i)).toBeInTheDocument();
    });
  });

  it('login form accepts email OR username in single identifier field', async () => {
    const user = userEvent.setup();

    vi.mocked(signIn).mockResolvedValueOnce({
      ok: true,
      error: undefined,
      status: 200,
      url: null,
      code: undefined,
    });

    const { default: LoginPage } = await import('@/app/(public)/login/page');
    renderWithTheme(<LoginPage />);

    const identifierInput = screen.getByLabelText(/email atau username/i);
    expect(identifierInput).toBeInTheDocument();

    await user.type(identifierInput, 'budi@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    const submitButton = screen.getByRole('button', { name: /masuk/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('credentials', {
        identifier: 'budi@example.com',
        password: 'password123',
        redirect: false,
      });
    });
  });

  it('KYC "Isi Otomatis (Demo)" button fills template fields', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ kycStatus: 'PENDING' }),
    });

    const { default: KycPage } = await import('@/app/kyc/page');
    renderWithTheme(<KycPage />);

    await waitFor(() => {
      expect(screen.getByText(/isi otomatis \(demo\)/i)).toBeInTheDocument();
    });

    const autoFillButton = screen.getByRole('button', { name: /isi otomatis \(demo\)/i });
    await user.click(autoFillButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('3201234567890001')).toBeInTheDocument();
    });
  });

  it('verify button shows progress ~3s then success state "Verifikasi berhasil!"', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kycStatus: 'PENDING' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true }),
      });

    const { default: KycPage } = await import('@/app/kyc/page');
    renderWithTheme(<KycPage />);

    await waitFor(() => {
      expect(screen.getByText(/isi otomatis \(demo\)/i)).toBeInTheDocument();
    });

    const autoFillButton = screen.getByRole('button', { name: /isi otomatis \(demo\)/i });
    await user.click(autoFillButton);

    const verifyButton = screen.getByRole('button', { name: /verifikasi sekarang/i });
    await user.click(verifyButton);

    // Progres tampil seketika, sebelum jeda 3 detik selesai.
    expect(screen.getByText(/sedang diverifikasi/i)).toBeInTheDocument();
    const startedAt = Date.now();

    await waitFor(
      () => {
        expect(screen.getByText(/verifikasi berhasil/i)).toBeInTheDocument();
      },
      { timeout: 8000, interval: 100 }
    );

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2500);
  }, 15000);
});
