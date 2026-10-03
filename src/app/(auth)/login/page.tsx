'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ActionIcon, Alert, Anchor, Button, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconEye, IconEyeOff } from '@tabler/icons-react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthShell } from '@/components/auth/AuthShell';
import { loginSchema } from '@/lib/validation';

type LoginFormData = z.infer<typeof loginSchema>;

// #c92a2a = 5.46:1 di putih dan 4.86:1 di latar light merah Alert.
// Warna red bawaan Mantine (#fa5252) hanya 3.28:1, gagal WCAG AA.
const ERROR_COLOR = '#c92a2a';

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    setFocus,
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
        setFocus('identifier');
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
    <AuthShell title="Masuk" subtitle="Login dengan email atau username">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Email atau Username"
            placeholder="email@example.com atau username"
            autoComplete="username"
            autoFocus
            {...register('identifier')}
            name="identifier"
            error={errors.identifier?.message}
            required
          />

          <TextInput
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Password Anda"
            autoComplete="current-password"
            rightSectionPointerEvents="all"
            rightSectionWidth={44}
            rightSection={
              <ActionIcon
                type="button"
                variant="subtle"
                color="gray"
                size={44}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <IconEyeOff size={20} aria-hidden="true" />
                ) : (
                  <IconEye size={20} aria-hidden="true" />
                )}
              </ActionIcon>
            }
            {...register('password')}
            error={errors.password?.message}
            required
          />

          {serverError && (
            <Alert
              icon={<IconAlertCircle size={18} aria-hidden="true" />}
              color="red"
              variant="light"
              aria-live="polite"
              styles={{
                root: { color: ERROR_COLOR },
                message: { color: ERROR_COLOR },
              }}
            >
              {serverError}
            </Alert>
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
    </AuthShell>
  );
}
