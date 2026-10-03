'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ActionIcon, Alert, Anchor, Button, Divider, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconEye, IconEyeOff } from '@tabler/icons-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthShell } from '@/components/auth/AuthShell';
import { registerSchema } from '@/lib/validation';

type RegisterFormData = z.infer<typeof registerSchema>;

// Jeda singkat supaya notifikasi sukses sempat terbaca sebelum halaman dialihkan.
const REDIRECT_DELAY_MS = 800;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);
    setServerError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError('username', {
            type: 'manual',
            message: result.error || 'Username atau email sudah digunakan',
          });
        } else {
          setServerError(result.error || 'Registrasi gagal');
        }
        setIsSubmitting(false);
        return;
      }

      notifications.show({
        title: 'Registrasi berhasil',
        message: 'Akun Anda berhasil dibuat.',
        color: 'teal',
      });

      const signInResult = await signIn('credentials', {
        identifier: data.email,
        password: data.password,
        redirect: false,
      });

      // Beri jeda agar notifikasi sukses terlihat sebelum pindah halaman.
      await new Promise((resolve) => setTimeout(resolve, REDIRECT_DELAY_MS));

      if (signInResult?.ok) {
        router.push('/kyc');
      } else {
        router.push('/login');
      }
    } catch {
      setServerError('Terjadi kesalahan. Silakan coba lagi.');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell title="Daftar Akun" subtitle="Buat akun baru untuk mulai berinvestasi">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="md">
          <Divider label="Data akun" labelPosition="left" />

          <TextInput
            label="Nama"
            placeholder="Nama lengkap Anda"
            autoComplete="name"
            autoFocus
            {...register('name')}
            error={errors.name?.message}
            required
          />

          <TextInput
            label="Username"
            placeholder="username_anda"
            description="Huruf kecil, angka, dan underscore. Min 3 karakter."
            autoComplete="username"
            {...register('username')}
            error={errors.username?.message}
            required
          />

          <TextInput
            label="Email"
            type="email"
            placeholder="email@example.com"
            autoComplete="email"
            inputMode="email"
            {...register('email')}
            error={errors.email?.message}
            required
          />

          <Divider label="Keamanan" labelPosition="left" mt="xs" />

          <TextInput
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimal 8 karakter"
            autoComplete="new-password"
            rightSectionWidth={44}
            rightSectionPointerEvents="auto"
            rightSection={
              <ActionIcon
                variant="subtle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </ActionIcon>
            }
            {...register('password')}
            error={errors.password?.message}
            required
          />

          <TextInput
            label="Nomor Telepon (opsional)"
            placeholder="081234567890"
            autoComplete="tel"
            inputMode="tel"
            {...register('phone', {
              // Kolom ini benar-benar opsional: kirim undefined, bukan string kosong,
              // supaya aturan min(8) tidak memblokir form yang dibiarkan kosong.
              setValueAs: (value: string) => (value === '' ? undefined : value),
            })}
            error={errors.phone?.message}
          />

          {serverError && (
            <Alert
              color="#c92a2a"
              variant="light"
              icon={<IconAlertCircle size={18} />}
              styles={{ message: { color: '#c92a2a' } }}
              aria-live="polite"
            >
              {serverError}
            </Alert>
          )}

          <Button type="submit" loading={isSubmitting} fullWidth mt="sm">
            Daftar
          </Button>

          <Text size="xs" ta="center" c="dimmed">
            Dengan mendaftar, Anda menyetujui{' '}
            <Anchor component={Link} href="/syarat-ketentuan" size="xs">
              Syarat &amp; Ketentuan
            </Anchor>{' '}
            dan{' '}
            <Anchor component={Link} href="/kebijakan-privasi" size="xs">
              Kebijakan Privasi
            </Anchor>
            .
          </Text>

          <Text size="sm" ta="center" c="dimmed">
            Sudah punya akun?{' '}
            <Anchor component={Link} href="/login">
              Masuk di sini
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthShell>
  );
}
