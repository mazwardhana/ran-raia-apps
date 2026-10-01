import '@testing-library/jest-dom/vitest';

import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { theme } from '@/theme/theme';

const root = process.cwd();

function readJson(file: string) {
  return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
}

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

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

describe('PWA packaging', () => {
  it('manifest declares app identity, standalone display, colors and icons', () => {
    const manifest = readJson('public/manifest.json');

    // Nama lengkap diambil dari brief: 'Raia — Investasi Ternak'
    expect(manifest.name).toMatch(/^Raia/);
    expect(manifest.short_name).toBe('Raia');
    expect(manifest.start_url).toBe('/app');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);

    expect(Array.isArray(manifest.icons)).toBe(true);
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    for (const icon of manifest.icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.purpose).toMatch(/any|maskable/);
      const file = path.join(root, 'public', icon.src.replace(/^\//, ''));
      expect(existsSync(file), `icon ${icon.src} harus ada di public/`).toBe(true);
    }
  });

  it('offline page renders Indonesian offline message with link back home', async () => {
    const Page = (await import('@/app/offline/page')).default;
    expect(Page).toBeTypeOf('function');

    renderWithTheme(<Page />);

    expect(
      screen.getByText(/tidak tersambung|offline/i)
    ).toBeInTheDocument();

    const back = screen.getByRole('link');
    expect(back).toHaveAttribute('href', '/');
  });

  it('next.config.mjs wraps config with Serwist', () => {
    const source = readFileSync(path.join(root, 'next.config.mjs'), 'utf8');
    expect(source).toContain('@serwist/next');
    expect(source).toMatch(/withSerwist/);
    expect(source).toContain('reactStrictMode');
    // Registrasi eksplisit: jangan biarkan bundler menyuntik ke entry yang salah.
    expect(source).toContain('register: false');
  });

  it('service worker is written with Serwist and waits instead of taking over tabs', () => {
    const source = readFileSync(path.join(root, 'src/app/sw.ts'), 'utf8');
    expect(source).toContain('new Serwist(');
    expect(source).toContain('skipWaiting: false');
    expect(source).toContain('NetworkOnly');
    expect(source).toMatch(/\/api\\\/\(auth\|payments\|kyc\)/);
  });

  it('registers the service worker explicitly in production only', () => {
    const source = readFileSync(
      path.join(root, 'src/components/shared/ServiceWorkerRegistrar.tsx'),
      'utf8'
    );
    expect(source).toContain(".register('/sw.js')");
    expect(source).toContain("process.env.NODE_ENV !== 'production'");
  });
});
