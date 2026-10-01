'use client';

import { Badge, Box, Button, Center, Paper, Stack, Text, Title } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  PAYMENT: 'Pembayaran',
  KYC: 'Verifikasi',
  PROFIT: 'Profit',
  LISTING: 'Listing',
  TAAWUN: 'Taawun',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function NotifikasiPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        notifications: NotificationItem[];
        unreadCount: number;
      };
      setNotifications(json.notifications ?? []);
      setUnreadCount(json.unreadCount ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markOne = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      // state lokal sudah optimis diperbarui; error server diabaikan
    }
  };

  const markAll = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // state lokal sudah optimis diperbarui; error server diabaikan
    }
  };

  if (loading) {
    return (
      <Center mih={200}>
        <Text c="dimmed">Memuat notifikasi...</Text>
      </Center>
    );
  }

  if (error) {
    return (
      <Center mih={200}>
        <Stack align="center" gap="sm">
          <Text c="red">Gagal memuat notifikasi</Text>
          <Button variant="light" onClick={() => void load()}>
            Coba lagi
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      <Box>
        <Title order={2}>Notifikasi</Title>
        <Text size="sm" c="dimmed">
          {unreadCount > 0 ? `${unreadCount} baru` : 'Semua sudah dibaca'}
        </Text>
      </Box>

      {unreadCount > 0 && (
        <Button
          variant="light"
          onClick={() => void markAll()}
          style={{ minHeight: 44, alignSelf: 'flex-start' }}
        >
          Tandai semua dibaca
        </Button>
      )}

      {notifications.length === 0 ? (
        <Center mih={200}>
          <Text c="dimmed">Belum ada notifikasi</Text>
        </Center>
      ) : (
        <Stack gap="sm">
          {notifications.map((n) => (
            <Paper
              key={n.id}
              withBorder
              p="md"
              radius="md"
              onClick={() => {
                if (!n.isRead) void markOne(n.id);
              }}
              style={{
                minHeight: 44,
                cursor: n.isRead ? 'default' : 'pointer',
                borderLeft: n.isRead ? undefined : '4px solid var(--mantine-color-teal-6)',
              }}
            >
              <Stack gap={4}>
                <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge size="sm" variant="light">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </Badge>
                  {!n.isRead && (
                    <Badge size="sm" color="teal" variant="filled">
                      Belum dibaca
                    </Badge>
                  )}
                </Box>
                <Text fw={600}>{n.title}</Text>
                <Text size="sm">{n.body}</Text>
                <Text size="xs" c="dimmed">
                  {formatDate(n.createdAt)}
                </Text>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
