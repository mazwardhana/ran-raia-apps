'use client';

import { Box } from '@mantine/core';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';

export interface AppShellProps {
  children: ReactNode;
  notificationCount?: number;
}

export function AppShell({ children, notificationCount = 0 }: AppShellProps) {
  const pathname = usePathname();

  return (
    <>
      <AppHeader notificationCount={notificationCount} />
      <Box
        component="main"
        style={{
          paddingTop: 'var(--header-h)',
          paddingBottom: 'var(--bottomnav-h)',
          minHeight: '100vh',
          backgroundColor: 'var(--mantine-color-gray-0)',
        }}
      >
        {children}
      </Box>
      <BottomNav currentPath={pathname} />
    </>
  );
}
