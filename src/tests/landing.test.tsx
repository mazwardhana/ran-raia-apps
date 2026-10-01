import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { theme } from '@/theme/theme';

// Pathname dikendalikan per-test supaya bottom nav bisa diuji di rute aktif,
// di rute biasa, dan di rute yang menyembunyikannya (/login, /register).
const navState = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    article: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    package: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
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

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

describe('Landing page', () => {
  it('renders hero CTA linking to /register', async () => {
    const { default: LandingPage } = await import('@/app/(public)/page');
    const jsx = await LandingPage();
    renderWithTheme(jsx);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const registerLinks = screen.getAllByRole('link', { name: /daftar sekarang/i });
    expect(registerLinks.length).toBeGreaterThan(0);
    expect(registerLinks[0]).toHaveAttribute('href', '/register');
  });

  it('navbar links only to existing routes', async () => {
    const { default: PublicLayout } = await import('@/app/(public)/layout');
    renderWithTheme(<PublicLayout>child</PublicLayout>);

    const nav = screen.getAllByRole('navigation')[0];
    expect(within(nav).getByRole('link', { name: /beranda/i })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /artikel/i })).toHaveAttribute('href', '/artikel');
    expect(within(nav).getByRole('link', { name: /paket/i })).toHaveAttribute('href', '/paket');
    expect(within(nav).getByRole('link', { name: /masuk/i })).toHaveAttribute('href', '/login');
    expect(within(nav).getByRole('link', { name: /daftar/i })).toHaveAttribute('href', '/register');
  });

  it('landing metadata has title and description', async () => {
    const { metadata } = await import('@/app/(public)/page');
    expect(metadata.title).toBeTruthy();
    expect(typeof metadata.title).toBe('string');
    expect(metadata.description).toBeTruthy();
    expect(String(metadata.description).length).toBeGreaterThan(50);
  });

  it('FAQ lists at least 5 product-specific questions', async () => {
    const { default: LandingPage } = await import('@/app/(public)/page');
    const jsx = await LandingPage();
    renderWithTheme(jsx);

    expect(screen.getAllByText(/apa itu jasa gaduh/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cara kerja lot/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ta.?awun/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/kapan.*(jual|keluar)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/siapa.*(mengelola|kelola)/i).length).toBeGreaterThan(0);
  });

  it('shows transparency section instead of fabricated testimonials', async () => {
    const { default: LandingPage } = await import('@/app/(public)/page');
    const jsx = await LandingPage();
    renderWithTheme(jsx);

    // Tidak boleh ada label "Data demo" maupun testimoni karangan di publik.
    expect(screen.queryByText(/data demo/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/transparansi dan audit/i).length).toBeGreaterThan(0);
  });
});

describe('Public bottom nav', () => {
  beforeEach(() => {
    navState.pathname = '/';
  });

  it('renders 4 items with valid hrefs and active state', async () => {
    navState.pathname = '/paket';
    const { PublicBottomNav } = await import('@/components/shared/PublicBottomNav');
    renderWithTheme(<PublicBottomNav />);

    const nav = screen.getByRole('navigation', { name: /navigasi bawah/i });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/paket',
      '/artikel',
      '/register',
    ]);

    expect(within(nav).getByRole('link', { name: /paket/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: /beranda/i })).not.toHaveAttribute('aria-current');
  });

  it('hides itself on /login and /register', async () => {
    const { PublicBottomNav } = await import('@/components/shared/PublicBottomNav');

    navState.pathname = '/login';
    const loginView = renderWithTheme(<PublicBottomNav />);
    expect(
      screen.queryByRole('navigation', { name: /navigasi bawah/i }),
    ).not.toBeInTheDocument();
    loginView.unmount();

    navState.pathname = '/register';
    renderWithTheme(<PublicBottomNav />);
    expect(
      screen.queryByRole('navigation', { name: /navigasi bawah/i }),
    ).not.toBeInTheDocument();
  });
});

describe('Article list page', () => {
  it('shows article titles from seed fixture (7 items)', async () => {
    const { default: ArtikelPage } = await import('@/app/(public)/artikel/page');
    const jsx = await ArtikelPage();
    renderWithTheme(jsx);

    const links = screen.getAllByRole('link', { name: /./i });
    expect(links.length).toBeGreaterThanOrEqual(7);
    expect(screen.getAllByText(/jasa gaduh/i).length).toBeGreaterThan(0);
  });

  it('article list metadata has title and description', async () => {
    const { metadata } = await import('@/app/(public)/artikel/page');
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
  });
});

describe('Article detail page', () => {
  it('renders article content by slug', async () => {
    const { default: ArticleDetail } = await import('@/app/(public)/artikel/[slug]/page');
    const jsx = await ArticleDetail({ params: { slug: 'apa-itu-jasa-gaduh-ternak' } });
    renderWithTheme(jsx);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/jasa gaduh/i);
  });

  it('article detail metadata has title and description', async () => {
    const { generateMetadata } = await import('@/app/(public)/artikel/[slug]/page');
    const meta = await generateMetadata({ params: { slug: 'apa-itu-jasa-gaduh-ternak' } });
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
  });
});

describe('Public package catalog', () => {
  it('renders package cards with register CTA and no buy button', async () => {
    const { default: PaketPage } = await import('@/app/(public)/paket/page');
    const jsx = await PaketPage();
    renderWithTheme(jsx);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /daftar untuk membeli/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /beli sekarang/i })).not.toBeInTheDocument();
  });

  it('paket metadata has title and description', async () => {
    const { metadata } = await import('@/app/(public)/paket/page');
    expect(metadata.title).toBeTruthy();
    expect(metadata.description).toBeTruthy();
  });
});
