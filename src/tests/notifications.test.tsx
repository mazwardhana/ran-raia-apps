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

const prismaMocks = vi.hoisted(() => ({
  notification: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
}));

const authMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

const state = vi.hoisted(() => ({
  prisma: prismaMocks as unknown as {
    notification: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  },
  auth: authMocks as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('@/lib/prisma', () => {
  state.prisma = prismaMocks;
  return { prisma: prismaMocks };
});

vi.mock('@/lib/auth', () => {
  state.auth = authMocks;
  return authMocks;
});

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
  state.auth.getCurrentUser.mockReset().mockResolvedValue({
    id: 'user-1',
    role: 'INVESTOR',
    username: 'investor_budi',
    kycStatus: 'VERIFIED',
  });
  state.prisma.notification.findMany.mockReset().mockResolvedValue([]);
  state.prisma.notification.create.mockReset().mockResolvedValue({ id: 'notif-1' });
  state.prisma.notification.updateMany.mockReset().mockResolvedValue({ count: 0 });
  state.prisma.notification.count.mockReset().mockResolvedValue(0);
});

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

const sampleNotifications = [
  {
    id: 'notif-2',
    type: 'PROFIT',
    title: 'Profit dibagikan',
    body: 'Paket Sapi Q1: Rp150.000 masuk saldo.',
    isRead: false,
    createdAt: '2026-09-27T10:00:00.000Z',
  },
  {
    id: 'notif-1',
    type: 'KYC',
    title: 'KYC diverifikasi',
    body: 'Identitas Anda telah disetujui.',
    isRead: true,
    createdAt: '2026-09-26T08:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// createNotification helper
// ---------------------------------------------------------------------------

describe('createNotification helper', () => {
  it('never throws when the database write fails', async () => {
    const { createNotification } = await import('@/lib/notifications');

    state.prisma.notification.create.mockRejectedValue(new Error('db down'));

    await expect(
      createNotification({
        userId: 'user-1',
        type: 'PAYMENT',
        title: 'Pembayaran berhasil',
        body: 'Order INV-1 lunas.',
      }),
    ).resolves.toBeUndefined();
  });

  it('persists notification with serialized data payload', async () => {
    const { createNotification } = await import('@/lib/notifications');

    await createNotification({
      userId: 'user-1',
      type: 'LISTING',
      title: 'Listing baru',
      body: 'Paket Kambing ditawarkan.',
      data: { listingId: 'lst-1' },
    });

    expect(state.prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        type: 'LISTING',
        title: 'Listing baru',
        body: 'Paket Kambing ditawarkan.',
        data: expect.stringContaining('lst-1'),
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

describe('GET /api/notifications', () => {
  it('returns 401 when there is no session user', async () => {
    state.auth.getCurrentUser.mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(new Request('http://localhost/api/notifications'));

    expect(res.status).toBe(401);
    expect(state.prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('returns session user notifications newest-first with limit', async () => {
    state.prisma.notification.findMany.mockResolvedValue(sampleNotifications);
    state.prisma.notification.count.mockResolvedValue(7);

    const { GET } = await import('@/app/api/notifications/route');
    const res = await GET(new Request('http://localhost/api/notifications?limit=10'));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notifications).toHaveLength(2);
    expect(json.notifications[0].id).toBe('notif-2');
    expect(json.unreadCount).toBe(1);

    expect(state.prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// PUT /api/notifications
// ---------------------------------------------------------------------------

describe('PUT /api/notifications', () => {
  it('returns 401 when there is no session user', async () => {
    state.auth.getCurrentUser.mockResolvedValueOnce(null);

    const { PUT } = await import('@/app/api/notifications/route');
    const res = await PUT(
      new Request('http://localhost/api/notifications', {
        method: 'PUT',
        body: JSON.stringify({ id: 'notif-2' }),
      }),
    );

    expect(res.status).toBe(401);
    expect(state.prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('marks a single notification read scoped to the session user', async () => {
    state.prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    const { PUT } = await import('@/app/api/notifications/route');
    const res = await PUT(
      new Request('http://localhost/api/notifications', {
        method: 'PUT',
        body: JSON.stringify({ id: 'notif-2' }),
      }),
    );

    expect(res.status).toBe(200);
    expect(state.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-2', userId: 'user-1' },
      data: { isRead: true },
    });
  });

  it('marks all notifications read when all=true', async () => {
    state.prisma.notification.updateMany.mockResolvedValue({ count: 3 });

    const { PUT } = await import('@/app/api/notifications/route');
    const res = await PUT(
      new Request('http://localhost/api/notifications', {
        method: 'PUT',
        body: JSON.stringify({ all: true }),
      }),
    );

    expect(res.status).toBe(200);
    expect(state.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    });
  });

  it('returns 400 on a malformed body', async () => {
    const { PUT } = await import('@/app/api/notifications/route');
    const res = await PUT(
      new Request('http://localhost/api/notifications', {
        method: 'PUT',
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(400);
    expect(state.prisma.notification.updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Halaman /app/notifikasi
// ---------------------------------------------------------------------------

describe('Halaman notifikasi', () => {
  it('menampilkan state memuat lalu daftar notifikasi dengan badge belum dibaca', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: sampleNotifications, unreadCount: 1 }),
    }) as unknown as typeof fetch;

    const NotifikasiPage = (await import('@/app/app/notifikasi/page')).default;
    renderWithTheme(<NotifikasiPage />);

    expect(screen.getByText(/memuat notifikasi/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Profit dibagikan')).toBeInTheDocument();
    });

    expect(screen.getByText('KYC diverifikasi')).toBeInTheDocument();
    expect(screen.getByText(/belum dibaca/i)).toBeInTheDocument();
  });

  it('menampilkan empty state ketika tidak ada notifikasi', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [], unreadCount: 0 }),
    }) as unknown as typeof fetch;

    const NotifikasiPage = (await import('@/app/app/notifikasi/page')).default;
    renderWithTheme(<NotifikasiPage />);

    await waitFor(() => {
      expect(screen.getByText(/belum ada notifikasi/i)).toBeInTheDocument();
    });
  });

  it('menampilkan state error dengan tombol coba lagi ketika fetch gagal', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const NotifikasiPage = (await import('@/app/app/notifikasi/page')).default;
    renderWithTheme(<NotifikasiPage />);

    await waitFor(() => {
      expect(screen.getByText(/gagal memuat notifikasi/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();
  });

  it('menandai semua notifikasi dibaca saat tombol ditekan', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notifications: sampleNotifications, unreadCount: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, count: 1 }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const NotifikasiPage = (await import('@/app/app/notifikasi/page')).default;
    renderWithTheme(<NotifikasiPage />);

    await waitFor(() => {
      expect(screen.getByText('Profit dibagikan')).toBeInTheDocument();
    });

    const markAllButton = screen.getByRole('button', { name: /tandai semua dibaca/i });
    await userEvent.click(markAllButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notifications',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });
});
