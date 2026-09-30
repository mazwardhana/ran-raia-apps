'use client';

import { Burger, Button, Drawer, Stack, Text } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconBuildingWarehouse,
  IconCash,
  IconChartBar,
  IconExchange,
  IconHeartHandshake,
  IconHome2,
  IconLogout,
  IconPackage,
  IconPaw,
  IconSettings,
} from '@tabler/icons-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: typeof IconHome2;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/op', label: 'Beranda', icon: IconHome2 },
  { href: '/op/site-projects', label: 'Site Project', icon: IconBuildingWarehouse },
  { href: '/op/paket', label: 'Paket', icon: IconPackage },
  { href: '/op/ternak', label: 'Ternak', icon: IconPaw },
  { href: '/op/profit', label: 'Profit', icon: IconChartBar },
  { href: '/op/taawun', label: "Ta'awun", icon: IconHeartHandshake },
  { href: '/op/secondary', label: 'Secondary', icon: IconExchange },
  { href: '/op/penarikan', label: 'Penarikan', icon: IconCash },
  { href: '/op/settings', label: 'Pengaturan', icon: IconSettings },
];

const brand = (
  <Text fw={700} size="lg">
    Raia Operator
  </Text>
);

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi operator">
      <Stack gap={4}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 44,
                padding: '0 12px',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: active ? 600 : 500,
                color: active
                  ? 'var(--mantine-color-teal-9)'
                  : 'var(--mantine-color-gray-7)',
                background: active ? 'var(--mantine-color-teal-1)' : 'transparent',
              }}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </Stack>
    </nav>
  );
}

function LogoutButton() {
  return (
    <Button
      variant="light"
      color="red"
      fullWidth
      leftSection={<IconLogout size={16} aria-hidden="true" />}
      style={{ minHeight: 44 }}
      onClick={() => {
        void signOut({ callbackUrl: '/login' });
      }}
    >
      Keluar
    </Button>
  );
}

export function OperatorShell({ children }: { children: ReactNode }) {
  const [opened, { close, toggle }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 48em)');

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--mantine-color-gray-0)' }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '6px 12px',
            minHeight: 56,
            background: 'var(--mantine-color-white)',
            borderBottom: '1px solid var(--mantine-color-gray-3)',
          }}
        >
          <Burger opened={opened} onClick={toggle} aria-label="Buka menu navigasi" size="sm" />
          {brand}
          <span style={{ width: 36 }} aria-hidden="true" />
        </header>

        <Drawer
          opened={opened}
          onClose={close}
          title="Menu operator"
          size="xs"
          position="left"
          transitionProps={{ transition: 'slide-right', duration: 200 }}
        >
          <NavList onNavigate={close} />
          <div style={{ marginTop: 16 }}>
            <LogoutButton />
          </div>
        </Drawer>

        <main style={{ padding: 12, minWidth: 0 }}>{children}</main>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--mantine-color-gray-0)',
      }}
    >
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '16px 12px',
          background: 'var(--mantine-color-white)',
          borderRight: '1px solid var(--mantine-color-gray-3)',
        }}
      >
        {brand}
        <NavList />
        <div style={{ marginTop: 'auto' }}>
          <LogoutButton />
        </div>
      </aside>

      <main style={{ flex: 1, padding: 24, minWidth: 0 }}>{children}</main>
    </div>
  );
}
