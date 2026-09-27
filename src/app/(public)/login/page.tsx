'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Anchor, Button, Stack, Text, TextInput } from '@mantine/core';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { loginSchema } from '@/lib/validation';

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setServerError('');

    try {
      const result = await signIn('credentials', {
        identifier: data.identifier,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError('Email/username atau password salah');
        setError('identifier', { type: 'manual', message: 'Email/username atau password salah' });
        setIsSubmitting(false);
        return;
      }

      if (result?.ok) {
        router.push('/app');
        router.refresh();
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
          Masuk
        </Text>
        <Text size="sm" c="dimmed">
          Login dengan email atau username
        </Text>
      </Stack>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Email atau Username"
            placeholder="email@example.com atau username"
            {...register('identifier')}
            error={errors.identifier?.message}
            required
          />

          <TextInput
            label="Password"
            type="password"
            placeholder="Password Anda"
            {...register('password')}
            error={errors.password?.message}
            required
          />

          {serverError && (
            <Text size="sm" c="red">
              {serverError}
            </Text>
          )}

          <Button type="submit" loading={isSubmitting} fullWidth mt="sm">
            Masuk
          </Button>

          <Text size="sm" ta="center" c="dimmed">
            Belum punya akun?{' '}
            <Anchor component={Link} href="/register">
              Daftar di sini
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Stack>
  );
}
