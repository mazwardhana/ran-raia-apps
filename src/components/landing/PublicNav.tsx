'use client';

import { Anchor, Burger, Drawer, Group, Stack } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import Link from 'next/link';

interface PublicNavItem {
  href: string;
  label: string;
  emphasis?: boolean;
}

const NAV_ITEMS: PublicNavItem[] = [
  { href: '/', label: 'Beranda' },
  { href: '/artikel', label: 'Artikel' },
  { href: '/paket', label: 'Paket' },
  { href: '/login', label: 'Masuk' },
  { href: '/register', label: 'Daftar', emphasis: true },
];

// Navigasi publik punya dua bentuk: baris link di layar lebar, Drawer + Burger
// di bawah 768px. Tanpa ini lima link berdesakan di 360px.
export function PublicNav() {
  const [opened, { close, toggle }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 48em)');

  if (isMobile) {
    return (
      <>
        {/* Burger adalah UnstyledButton, jadi default 44px theme tidak berlaku.
            minHeight/minWidth eksplisit menjaga target sentuh tetap 44x44. */}
        <Burger
          opened={opened}
          onClick={toggle}
          aria-label="Buka menu navigasi"
          size="sm"
          style={{ minHeight: 44, minWidth: 44 }}
        />
        <Drawer
          opened={opened}
          onClose={close}
          title="Menu"
          size="xs"
          position="right"
          transitionProps={{ transition: 'slide-left', duration: 200 }}
        >
          <nav aria-label="Navigasi utama">
            <Stack gap={4}>
              {NAV_ITEMS.map((item) => (
                <Anchor
                  key={item.href}
                  component={Link}
                  href={item.href}
                  onClick={close}
                  c={item.emphasis ? 'teal.7' : 'dark'}
                  fw={item.emphasis ? 600 : 500}
                  underline="never"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: 44,
                    padding: '0 8px',
                    borderRadius: 8,
                  }}
                >
                  {item.label}
                </Anchor>
              ))}
            </Stack>
          </nav>
        </Drawer>
      </>
    );
  }

  return (
    <nav aria-label="Navigasi utama">
      <Group gap="lg">
        {NAV_ITEMS.map((item) => (
          <Anchor
            key={item.href}
            component={Link}
            href={item.href}
            c={item.emphasis ? 'teal.7' : 'dark'}
            fw={item.emphasis ? 600 : 500}
            underline="hover"
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
          >
            {item.label}
          </Anchor>
        ))}
      </Group>
    </nav>
  );
}
