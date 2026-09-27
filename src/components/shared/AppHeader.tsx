'use client';

import { ActionIcon, Badge, Box, Group, Text } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { EmptyState } from '@/components/ui/EmptyState';

export interface AppHeaderProps {
  notificationCount?: number;
}

export function AppHeader({ notificationCount = 0 }: AppHeaderProps) {
  const [notifModalOpen, setNotifModalOpen] = useState(false);

  return (
    <Box
      component="header"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--mantine-color-white)',
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        zIndex: 100,
        padding: '12px 16px',
      }}
    >
      <Group justify="space-between" align="center">
        <Text size="lg" fw={700}>
          Raia
        </Text>
        <Box style={{ position: 'relative' }}>
          <ActionIcon
            variant="subtle"
            size={44}
            aria-label="Notifikasi"
            onClick={() => setNotifModalOpen(true)}
          >
            <IconBell size={20} />
          </ActionIcon>
          {notificationCount > 0 && (
            <Badge
              size="xs"
              circle
              color="red"
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                minWidth: 16,
                height: 16,
                padding: 0,
              }}
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </Badge>
          )}
        </Box>
      </Group>

      <BaseModal
        opened={notifModalOpen}
        onClose={() => setNotifModalOpen(false)}
        title="Notifikasi"
        size="md"
      >
        <EmptyState
          title="Belum ada notifikasi"
          description="Fitur notifikasi sedang disiapkan dan akan segera tersedia."
        />
      </BaseModal>
    </Box>
  );
}
