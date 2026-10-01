'use client';

import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';

const UPDATE_NOTIFICATION_ID = 'sw-update-available';

/**
 * Mendaftarkan service worker secara eksplisit.
 *
 * next-pwa dulu menyuntik registrasi ke entry `main.js` (Pages Router) sehingga
 * di App Router SW tidak pernah terdaftar. Registrasi manual di sini menghapus
 * seluruh kelas bug tersebut, sekaligus jadi tempat prompt update.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // SW tidak pernah diuji di dev (disable di next.config.mjs), jadi jangan daftar.
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let reloadRequested = false;

    const showUpdatePrompt = (registration: ServiceWorkerRegistration) => {
      notifications.show({
        id: UPDATE_NOTIFICATION_ID,
        title: 'Versi baru tersedia',
        color: 'teal',
        autoClose: false,
        withCloseButton: true,
        message: (
          <Stack gap="xs">
            <Text size="sm">
              Aplikasi sudah diperbarui. Muat ulang untuk memakai versi terbaru.
            </Text>
            <Group justify="flex-end">
              <Button
                size="xs"
                onClick={() => {
                  reloadRequested = true;
                  // SW menunggu (skipWaiting: false). Perintah ini yang membuatnya aktif.
                  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
                  notifications.hide(UPDATE_NOTIFICATION_ID);
                }}
              >
                Muat ulang
              </Button>
            </Group>
          </Stack>
        ),
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Sudah ada SW versi baru yang menunggu sejak sebelum halaman ini dibuka.
        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdatePrompt(registration);
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // `controller` memastikan ini update, bukan pemasangan pertama.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdatePrompt(registration);
            }
          });
        });
      })
      .catch((error) => {
        // Gagal mendaftar SW tidak boleh mematikan aplikasi; cukup dicatat.
        console.error('Gagal mendaftarkan service worker:', error);
      });

    const handleControllerChange = () => {
      // Reload hanya setelah user menekan "Muat ulang", agar pemasangan
      // pertama (clientsClaim) tidak memicu reload tak terduga.
      if (reloadRequested) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
