'use client';

import { ActionIcon, Badge, Box, Group, Text } from '@mantine/core';
import { IconArrowLeft, IconBell } from '@tabler/icons-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { EmptyState } from '@/components/ui/EmptyState';

export interface AppHeaderProps {
  notificationCount?: number;
}

// Judul halaman memberi orientasi di PWA standalone yang tidak punya tombol
// back browser. Rute dinamis diperiksa lebih dulu supaya tidak tertangkap
// oleh prefix halaman daftarnya.
export function getPageTitle(pathname: string): string {
  if (/^\/app\/paket\/[^/]+$/.test(pathname)) return 'Detail Paket';
  if (pathname.startsWith('/app/paket')) return 'Paket Ternak';
  if (/^\/app\/portofolio\/[^/]+$/.test(pathname)) return 'Detail Portofolio';
  if (pathname.startsWith('/app/portofolio')) return 'Portofolio';
  if (pathname.startsWith('/app/secondary')) return 'Secondary Market';
  if (pathname.startsWith('/app/transaksi')) return 'Transaksi';
  if (pathname.startsWith('/app/checkout')) return 'Checkout';
  if (pathname.startsWith('/app/bayar-simulasi')) return 'Pembayaran';
  if (pathname.startsWith('/app/penarikan')) return 'Penarikan';
  if (pathname.startsWith('/app/notifikasi')) return 'Notifikasi';
  if (pathname.startsWith('/app/profil')) return 'Profil';
  return 'Raia';
}

export function AppHeader({ notificationCount = 0 }: AppHeaderProps) {
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isRoot = pathname === '/app';
  const title = getPageTitle(pathname);

  const handleBack = () => {
    // Deep link di PWA standalone bisa tidak punya riwayat; jatuh ke dashboard.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/app');
    }
  };

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
        paddingTop: 'calc(12px + env(safe-area-inset-top))',
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
          {!isRoot && (
            <ActionIcon
              variant="subtle"
              size={44}
              aria-label="Kembali"
              onClick={handleBack}
            >
              <IconArrowLeft size={22} />
            </ActionIcon>
          )}
          {isRoot ? (
            <Text size="lg" fw={700}>
              Raia
            </Text>
          ) : (
            <Text size="lg" fw={600} truncate>
              {title}
            </Text>
          )}
        </Group>
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
