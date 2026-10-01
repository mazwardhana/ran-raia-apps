'use client';

import { MantineProvider } from '@mantine/core';
import { ReactNode } from 'react';

import { cssVariablesResolver, theme } from '@/theme/theme';

// MantineProvider adalah client component; resolver berupa fungsi harus
// dibuat di sisi client agar tidak melintasi batas server/client.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="light"
    >
      {children}
    </MantineProvider>
  );
}
