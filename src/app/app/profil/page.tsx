'use client';

import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconPencil } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { usernameSchema } from '@/lib/validation';

interface FormValues {
  username: string;
}

// Komponen yang diekspor tidak boleh memanggil hook langsung karena halaman ini
// juga dipanggil sebagai fungsi biasa pada pengujian; hook hidup di ProfilContent.
export default function ProfilPage() {
  return <ProfilContent />;
}

function ProfilContent() {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('—');
  const [displayUsername, setDisplayUsername] = useState('—');
  const [displayEmail, setDisplayEmail] = useState('—');
  const [displayPhone, setDisplayPhone] = useState('—');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const data = await res.json();
        const user = data?.user;
        if (cancelled || !user || typeof user !== 'object') return;
        if (typeof user.name === 'string' && user.name) setDisplayName(user.name);
        if (typeof user.username === 'string' && user.username) setDisplayUsername(user.username);
        if (typeof user.email === 'string' && user.email) setDisplayEmail(user.email);
        if (typeof user.phone === 'string' && user.phone) setDisplayPhone(user.phone);
      } catch {
        // Data awal tidak tersedia; baris profil tetap menampilkan placeholder.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { username: '' },
  });

  const rows = [
    { label: 'Nama', value: displayName },
    { label: 'Username', value: displayUsername },
    { label: 'Email', value: displayEmail },
    { label: 'Telepon', value: displayPhone },
  ];

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSuccessMessage(null);

    const check = usernameSchema.safeParse(values.username);
    if (!check.success) {
      setFormError(check.error.errors[0].message);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: check.data }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(
          typeof data.error === 'string' && data.error
            ? data.error
            : 'Gagal memperbarui profil. Coba lagi.'
        );
        return;
      }

      const updated = data.user ?? {};
      if (typeof updated.username === 'string') {
        setDisplayUsername(updated.username);
      }
      if (typeof updated.name === 'string' && updated.name) {
        setDisplayName(updated.name);
      }
      if (typeof updated.email === 'string' && updated.email) {
        setDisplayEmail(updated.email);
      }
      if (typeof updated.phone === 'string') {
        setDisplayPhone(updated.phone || '—');
      }
      setSuccessMessage('Profil berhasil diperbarui.');
      setEditing(false);
      reset({ username: '' });
    } catch {
      setFormError('Gagal memperbarui profil. Coba lagi.');
    } finally {
      setSaving(false);
    }
  });

  return (
    <Stack gap="lg" maw={640} mx="auto" py="md">
      <div>
        <Text fw={700} size="xl">
          Profil Saya
        </Text>
        <Text size="sm" c="dimmed">
          Informasi akun investasi Anda.
        </Text>
      </div>

      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="md">
          <Text fw={600} size="lg">
            Informasi Akun
          </Text>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Ubah Username"
            size={44}
            onClick={() => {
              setFormError(null);
              setSuccessMessage(null);
              setEditing((current) => !current);
            }}
          >
            <IconPencil size={20} stroke={1.5} />
          </ActionIcon>
        </Group>

        <Stack gap="xs">
          {rows.map((row) => (
            <Group key={row.label} justify="space-between" py={4}>
              <Text size="sm" c="dimmed">
                {row.label}
              </Text>
              <Text size="sm" fw={600}>
                {row.value}
              </Text>
            </Group>
          ))}
        </Stack>

        {successMessage && (
          <Alert
            icon={<IconCheck size={18} />}
            color="green"
            variant="light"
            mt="md"
            role="status"
          >
            {successMessage}
          </Alert>
        )}

        {editing && (
          <form onSubmit={onSubmit} noValidate style={{ marginTop: 'var(--mantine-spacing-md)' }}>
            <Stack gap="md">
              <TextInput
                label="Username Baru"
                placeholder="contoh_username"
                withAsterisk
                styles={{ input: { minHeight: 44 } }}
                {...register('username')}
              />

              {formError && (
                <Alert
                  icon={<IconAlertCircle size={18} />}
                  color="red"
                  variant="light"
                  role="alert"
                >
                  {formError}
                </Alert>
              )}

              <Group justify="flex-end">
                <Button
                  type="button"
                  variant="default"
                  size="md"
                  mih={44}
                  onClick={() => {
                    setEditing(false);
                    setFormError(null);
                    reset({ username: '' });
                  }}
                >
                  Batal
                </Button>
                <Button type="submit" size="md" mih={44} loading={saving}>
                  Simpan
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Card>
    </Stack>
  );
}
