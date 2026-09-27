import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { theme } from '@/theme/theme';

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

  it('testimonials are labelled as demo data', async () => {
    const { default: LandingPage } = await import('@/app/(public)/page');
    const jsx = await LandingPage();
    renderWithTheme(jsx);

    expect(screen.getAllByText(/data demo/i).length).toBeGreaterThan(0);
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
