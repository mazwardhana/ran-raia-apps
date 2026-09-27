import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Impor statis agar factory vi.mock '@/lib/prisma' dievaluasi saat load file,
// sebelum hook beforeEach mengonfigurasi mock-nya.
import '@/lib/prisma';
import { theme } from '@/theme/theme';

// ---------------------------------------------------------------------------
// Mocks (vi.mock di-hoist di atas import modul yang diuji)
// ---------------------------------------------------------------------------

const state = vi.hoisted(() => ({
  kycStatus: 'VERIFIED' as string,
  prisma: {} as {
    transaction: { aggregate: ReturnType<typeof vi.fn> };
    investorBalance: { findUnique: ReturnType<typeof vi.fn> };
    lotOwnership: { findMany: ReturnType<typeof vi.fn> };
    fullOwnership: { findMany: ReturnType<typeof vi.fn> };
    profitDistribution: { findMany: ReturnType<typeof vi.fn> };
    livestockEvent: { findMany: ReturnType<typeof vi.fn> };
    package: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
    siteProject: { findMany: ReturnType<typeof vi.fn> };
  },
  auth: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    transaction: { aggregate: vi.fn() },
    investorBalance: { findUnique: vi.fn() },
    lotOwnership: { findMany: vi.fn() },
    fullOwnership: { findMany: vi.fn() },
    profitDistribution: { findMany: vi.fn() },
    livestockEvent: { findMany: vi.fn() },
    package: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    siteProject: { findMany: vi.fn() },
  };
  state.prisma = prisma;
  return { prisma };
});

vi.mock('@/lib/auth', () => {
  const auth = {
    getCurrentUser: vi.fn(async () => ({
      id: 'user-1',
      role: 'INVESTOR',
      username: 'budi_investor',
      kycStatus: state.kycStatus,
    })),
  };
  state.auth = auth;
  return auth;
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
      removeListener: {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
});

beforeEach(() => {
  state.kycStatus = 'VERIFIED';

  state.prisma.transaction.aggregate.mockReset().mockResolvedValue({
    _sum: { amount: 15000000 },
  });
  state.prisma.investorBalance.findUnique.mockReset().mockResolvedValue({
    totalEarned: 2400000,
  });
  state.prisma.lotOwnership.findMany.mockReset().mockResolvedValue([
    {
      packageId: 'pkg1',
      lotStart: 1,
      lotEnd: 100,
      acquiredPrice: 10000,
      package: { animalType: 'KAMBING', price: 10000000, totalLots: 1000 },
    },
    {
      packageId: 'pkg2',
      lotStart: 1,
      lotEnd: 350,
      acquiredPrice: 10000,
      package: { animalType: 'SAPI', price: 15000000, totalLots: 1500 },
    },
  ]);
  state.prisma.fullOwnership.findMany.mockReset().mockResolvedValue([]);
  state.prisma.profitDistribution.findMany.mockReset().mockResolvedValue([
    { period: '2026-04', investorShare: 300000, createdAt: new Date('2026-04-15') },
    { period: '2026-05', investorShare: 450000, createdAt: new Date('2026-05-15') },
    { period: '2026-06', investorShare: 500000, createdAt: new Date('2026-06-15') },
    { period: '2026-07', investorShare: 400000, createdAt: new Date('2026-07-15') },
    { period: '2026-08', investorShare: 350000, createdAt: new Date('2026-08-15') },
    { period: '2026-09', investorShare: 400000, createdAt: new Date('2026-09-15') },
  ]);
  state.prisma.livestockEvent.findMany.mockReset().mockResolvedValue([
    {
      id: 'ev1',
      eventType: 'BIRTH',
      eventDate: new Date('2026-09-20'),
      description: 'Kelahiran anak kambing',
      livestock: { tagNumber: 'K-001', name: 'Domba' },
    },
  ]);
  state.prisma.package.findMany.mockReset().mockResolvedValue([
    { id: 'pkg1', animalType: 'KAMBING', price: 10000000, totalLots: 1000 },
    { id: 'pkg2', animalType: 'SAPI', price: 15000000, totalLots: 1500 },
  ]);
  state.prisma.package.count.mockReset().mockResolvedValue(0);
  state.prisma.package.findUnique.mockReset().mockResolvedValue(null);
  state.prisma.siteProject.findMany.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Investor PWA Core', () => {
  it('bottom nav renders 5 links with valid hrefs and active state', async () => {
    const { BottomNav } = await import('@/components/shared/BottomNav');
    renderWithTheme(<BottomNav currentPath="/app/paket" />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);

    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      '/app',
      '/app/paket',
      '/app/portofolio',
      '/app/secondary',
      '/app/profil',
    ]);

    // Setiap tujuan navigasi harus benar-benar punya halaman (bukan dead link)
    const { existsSync } = await import('node:fs');
    const pageFiles: Record<string, string> = {
      '/app': 'src/app/(app)/page.tsx',
      '/app/paket': 'src/app/(app)/paket/page.tsx',
      '/app/portofolio': 'src/app/(app)/portofolio/page.tsx',
      '/app/secondary': 'src/app/(app)/secondary/page.tsx',
      '/app/profil': 'src/app/(app)/profil/page.tsx',
    };
    for (const href of hrefs) {
      expect(href, 'href wajib ada').toBeTruthy();
      expect(existsSync(pageFiles[href!]), `${href} harus punya page.tsx`).toBe(true);
    }

    // Touch target minimal 44px
    links.forEach((link) => {
      const minHeight = window.getComputedStyle(link).minHeight;
      if (minHeight && minHeight !== 'auto') {
        expect(parseFloat(minHeight)).toBeGreaterThanOrEqual(44);
      }
    });

    // Item aktif ditandai aria-current
    expect(screen.getByRole('link', { name: /Paket/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: /Dashboard/ })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('dashboard renders metric cards with values, charts, and activity feed', async () => {
    const Page = (await import('@/app/(app)/page')).default;
    const ui = await Page();
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByText('Total Investasi')).toBeInTheDocument();
    });

    expect(screen.getByText(/Rp\s*15\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*2\.400\.000/)).toBeInTheDocument();
    expect(screen.getByText('450')).toBeInTheDocument(); // jumlah lot

    // Chart: judul + legend distribusi per jenis ternak
    expect(screen.getByText('Distribusi portofolio')).toBeInTheDocument();
    expect(screen.getByText('Tren profit 6 bulan')).toBeInTheDocument();
    expect(screen.getByText('Kambing')).toBeInTheDocument();
    expect(screen.getByText('Sapi')).toBeInTheDocument();

    // Aktivitas ternak terbaru
    expect(screen.getByText('Aktivitas ternak terbaru')).toBeInTheDocument();
    expect(screen.getByText('Kelahiran anak kambing')).toBeInTheDocument();
  });

  it('dashboard shows KYC banner when kycStatus is PENDING', async () => {
    state.kycStatus = 'PENDING';

    const Page = (await import('@/app/(app)/page')).default;
    const ui = await Page();
    renderWithTheme(ui);

    const banner = screen.getByRole('link', { name: /verifikasi/i });
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute('href', '/kyc');
  });

  it('catalog fetches packages and filters them by search text', async () => {
    const all = {
      items: [
        {
          id: 'pkg1',
          code: 'PKG-001',
          title: 'Paket Kambing Etawa',
          animalType: 'KAMBING',
          price: 10000000,
          status: 'OPEN',
          soldLots: 50,
          totalLots: 1000,
          estimatedRoi: 25,
          coverImage: null,
          siteProject: { id: 's1', name: 'Site Purworejo', city: 'Purworejo' },
        },
        {
          id: 'pkg2',
          code: 'PKG-002',
          title: 'Paket Sapi Limousin',
          animalType: 'SAPI',
          price: 15000000,
          status: 'RUNNING',
          soldLots: 200,
          totalLots: 1500,
          estimatedRoi: 30,
          coverImage: null,
          siteProject: { id: 's2', name: 'Site Boyolali', city: 'Boyolali' },
        },
      ],
      total: 2,
      page: 1,
    };

    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string | URL) => {
        const u = String(url);
        let list = all.items;
        if (u.includes('search=')) {
          const q = decodeURIComponent(
            u.split('search=')[1].split('&')[0]
          ).toLowerCase();
          list = list.filter((item) => item.title.toLowerCase().includes(q));
        }
        return { ok: true, json: async () => ({ items: list, total: list.length, page: 1 }) };
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const CatalogPage = (await import('@/app/(app)/paket/page')).default;
    renderWithTheme(<CatalogPage />);

    await waitFor(() => {
      expect(screen.getByText('Paket Kambing Etawa')).toBeInTheDocument();
    });
    expect(screen.getByText('Paket Sapi Limousin')).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*10\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/50\s*\/\s*1\.000\s*lot/)).toBeInTheDocument();

    // Ketik teks pencarian → request disaring di server (query search)
    const searchInput = screen.getByLabelText('Cari paket');
    await userEvent.type(searchInput, 'kambing');

    await waitFor(
      () => {
        const urls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(urls.some((u) => u.includes('search=kambing'))).toBe(true);
      },
      { timeout: 3000 }
    );

    await waitFor(() => {
      expect(screen.queryByText('Paket Sapi Limousin')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Paket Kambing Etawa')).toBeInTheDocument();
  });

  it('catalog shows error state with retry when fetch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], total: 0, page: 1 }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const CatalogPage = (await import('@/app/(app)/paket/page')).default;
    renderWithTheme(<CatalogPage />);

    expect(await screen.findByText('Terjadi kesalahan')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));

    await waitFor(() => {
      expect(screen.getByText('Belum ada paket')).toBeInTheDocument();
    });
  });

  it('package detail shows site legal entity, cost breakdown, and progress', async () => {
    state.prisma.package.findUnique.mockResolvedValue({
      id: 'pkg1',
      code: 'PKG-001',
      title: 'Paket Kambing Etawa Q1',
      animalType: 'KAMBING',
      price: 10000000,
      lotPrice: 10000,
      totalLots: 1000,
      soldLots: 450,
      status: 'OPEN',
      description: 'Paket investasi kambing etawa produktif.',
      estimatedRoi: 25,
      estimatedOffspring: 2,
      estimatedOffspringPrice: 3000000,
      estimatedMilkMonthly: 60,
      estimatedMilkPrice: 6000,
      periodMonths: 12,
      startDate: new Date('2026-10-01'),
      endDate: new Date('2027-10-01'),
      coverImage: null,
      siteProject: {
        id: 's1',
        name: 'Site Purworejo',
        legalEntity: 'PT Raia Ternak Purworejo',
        address: 'Jl. Raya Purworejo No. 1',
        province: 'Jawa Tengah',
        city: 'Purworejo',
      },
      costs: [
        { costType: 'ANIMAL', amount: 5000000, description: 'Bibit kambing' },
        { costType: 'TAAWUN', amount: 300000, description: 'Proteksi jiwa ternak' },
        { costType: 'RENT', amount: 1200000, description: 'Sewa kandang' },
        { costType: 'FEED', amount: 2000000, description: 'Pakan 12 bulan' },
        { costType: 'LABOR', amount: 1000000, description: 'Tenaga kerja' },
        { costType: 'MEDICINE', amount: 300000, description: 'Obat dan vaksin' },
        { costType: 'OPERATIONAL', amount: 200000, description: 'Operasional lain' },
      ],
    });

    const Page = (await import('@/app/(app)/paket/[id]/page')).default;
    const ui = await Page({ params: { id: 'pkg1' } });
    renderWithTheme(ui);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Paket Kambing Etawa Q1' })).toBeInTheDocument();
    });

    // Identitas site + legalitas (read-only)
    expect(screen.getByText(/PT Raia Ternak Purworejo/)).toBeInTheDocument();
    expect(screen.getByText(/Site Purworejo/)).toBeInTheDocument();

    // Komposisi biaya: tiap baris breakdown tampil
    expect(screen.getByText('Biaya ternak')).toBeInTheDocument();
    expect(screen.getByText('Bibit kambing')).toBeInTheDocument();
    expect(screen.getByText("Dana ta'awun")).toBeInTheDocument();
    expect(screen.getByText(/Rp\s*5\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText('Total komposisi biaya')).toBeInTheDocument();

    // Progress slot
    expect(screen.getByText(/450\s*\/\s*1\.000\s*lot/)).toBeInTheDocument();

    // Estimasi return
    expect(screen.getByText('Estimasi return')).toBeInTheDocument();
    expect(screen.getByText(/ROI\s*25%/)).toBeInTheDocument();

    // CTA pembelian → checkout (rute Task 8)
    expect(screen.getByRole('link', { name: 'Beli Paket Utuh' })).toHaveAttribute(
      'href',
      '/app/checkout/pkg1'
    );
    expect(screen.getByRole('link', { name: 'Beli Lot' })).toHaveAttribute(
      'href',
      '/app/checkout/pkg1?mode=lot'
    );
  });

  it('rendered UI does not hardcode widths above 360px (viewport 360px)', async () => {
    const Page = (await import('@/app/(app)/page')).default;
    const ui = await Page();
    const { container } = renderWithTheme(ui);
    await waitFor(() => {
      expect(screen.getByText('Total Investasi')).toBeInTheDocument();
    });

    const offenders: string[] = [];
    const walk = (el: Element) => {
      const style = el.getAttribute('style') || '';
      const matches = style.match(/(?:^|;)\s*(?:min-)?width\s*:\s*([\d.]+)px/g) || [];
      for (const m of matches) {
        const px = parseFloat(m.split(':')[1]);
        if (px > 360) {
          offenders.push(`${el.tagName}.${el.className} → ${m.trim()}`);
        }
      }
      for (const child of Array.from(el.children)) walk(child);
    };
    walk(container);

    expect(offenders).toEqual([]);
  });
});
