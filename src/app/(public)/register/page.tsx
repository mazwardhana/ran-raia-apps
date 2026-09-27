'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Anchor, Button, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { registerSchema } from '@/lib/validation';

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        message: 'Akun Anda telah dibuat. Silakan masuk.',
        color: 'green',
      });

      const signInResult = await signIn('credentials', {
        identifier: data.email,
        password: data.password,
        redirect: false,
      });

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
    <Stack
      maw={480}
      mx="auto"
      py="xl"
      px="md"
      style={{ minHeight: '100vh', justifyContent: 'center' }}
    >
      <Stack gap="xs" mb="md">
        <Text size="xl" fw={700}>
          Daftar Akun
        </Text>
        <Text size="sm" c="dimmed">
          Buat akun baru untuk mulai berinvestasi
        </Text>
      </Stack>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Nama"
            placeholder="Nama lengkap Anda"
            {...register('name')}
            error={errors.name?.message}
            required
          />

          <TextInput
            label="Username"
            placeholder="username_anda"
            description="Huruf kecil, angka, dan underscore. Min 3 karakter."
            {...register('username')}
            error={errors.username?.message}
            required
          />

          <TextInput
            label="Email"
            type="email"
            placeholder="email@example.com"
            {...register('email')}
            error={errors.email?.message}
            required
          />

          <TextInput
            label="Password"
            type="password"
            placeholder="Minimal 8 karakter"
            {...register('password')}
            error={errors.password?.message}
            required
          />

          <TextInput
            label="Nomor Telepon"
            placeholder="081234567890"
            {...register('phone')}
            error={errors.phone?.message}
          />

          {serverError && (
            <Text size="sm" c="red">
              {serverError}
            </Text>
          )}

          <Button type="submit" loading={isSubmitting} fullWidth mt="sm">
            Daftar
          </Button>

          <Text size="sm" ta="center" c="dimmed">
            Sudah punya akun?{' '}
            <Anchor component={Link} href="/login">
              Masuk di sini
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Stack>
  );
}
