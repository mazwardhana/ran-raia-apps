'use client';

import { Box, Stack, Text } from '@mantine/core';
import { IconArticle, IconHome, IconPackage, IconUserPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface PublicBottomNavItem {
  href: string;
  label: string;
  icon: typeof IconHome;
  emphasis?: boolean;
}

const NAV_ITEMS: PublicBottomNavItem[] = [
  { href: '/', label: 'Beranda', icon: IconHome },
  { href: '/paket', label: 'Paket', icon: IconPackage },
  { href: '/artikel', label: 'Artikel', icon: IconArticle },
  { href: '/register', label: 'Daftar', icon: IconUserPlus, emphasis: true },
];

// Halaman autentikasi punya alur sendiri yang fokus ke satu aksi, jadi bottom
// nav disembunyikan di sana alih-alih menambah jalan keluar.
const HIDDEN_PATHS = ['/login', '/register'];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PublicBottomNav() {
  const pathname = usePathname() ?? '/';

  if (HIDDEN_PATHS.includes(pathname)) return null;

  return (
    <>
      <Box hiddenFrom="md" h="var(--bottomnav-h)" />
      <Box
        component="nav"
        aria-label="Navigasi bawah"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--mantine-color-white)',
          borderTop: '1px solid var(--mantine-color-gray-3)',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100,
        }}
      >
        <Box
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '6px 0',
            maxWidth: 520,
            margin: '0 auto',
            width: '100%',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const highlight = active || item.emphasis;
            const iconColor = highlight
              ? 'var(--mantine-color-teal-7)'
              : 'var(--mantine-color-dimmed)';

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  flex: 1,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <Stack gap={2} align="center" style={{ padding: '4px 8px' }}>
                  <Icon size={22} color={iconColor} aria-hidden="true" />
                  <Text size="xs" c={highlight ? 'teal.7' : 'dimmed'} fw={highlight ? 600 : 400}>
                    {item.label}
                  </Text>
                </Stack>
              </Link>
            );
          })}
        </Box>
      </Box>
    </>
  );
}
