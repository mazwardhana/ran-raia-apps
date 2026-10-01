'use client';

import { ActionIcon, Box, Stack, Text } from '@mantine/core';
import {
  IconChartPie,
  IconHome,
  IconPackage,
  IconRefresh,
  IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';

export interface BottomNavProps {
  currentPath: string;
}

const NAV_ITEMS = [
  { href: '/app', label: 'Dashboard', icon: IconHome },
  { href: '/app/paket', label: 'Paket', icon: IconPackage },
  { href: '/app/portofolio', label: 'Portofolio', icon: IconChartPie },
  { href: '/app/secondary', label: 'Secondary', icon: IconRefresh },
  { href: '/app/profil', label: 'Profil', icon: IconUser },
];

export function BottomNav({ currentPath }: BottomNavProps) {
  return (
    <Box
      component="nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--mantine-color-white)',
        borderTop: '1px solid var(--mantine-color-gray-3)',
        // Terasa seperti sheet yang naik dari bawah, bukan bar menempel.
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
          padding: '8px 0',
          maxWidth: 520,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          const isActive =
            item.href === '/app'
              ? currentPath === '/app'
              : currentPath.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                flex: 1,
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <Stack gap={4} align="center" style={{ padding: '4px 8px' }}>
                <ActionIcon
                  variant={isActive ? 'filled' : 'subtle'}
                  color={isActive ? 'blue' : 'gray'}
                  size="lg"
                  aria-hidden="true"
                >
                  <Icon size={20} />
                </ActionIcon>
                <Text
                  size="xs"
                  c={isActive ? 'blue' : 'dimmed'}
                  fw={isActive ? 600 : 400}
                >
                  {item.label}
                </Text>
              </Stack>
            </Link>
          );
        })}
      </Box>
    </Box>
  );
}
