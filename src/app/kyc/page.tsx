'use client';

import { Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconCheck, IconUpload } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';

interface KYCFormData {
  nik: string;
  placeOfBirth: string;
  dateOfBirth: string;
  address: string;
  ktpImage: string;
  selfieImage: string;
}

type VerificationState = 'idle' | 'verifying' | 'success';

export default function KycPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string>('PENDING');
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [formData, setFormData] = useState<KYCFormData>({
    nik: '',
    placeOfBirth: '',
    dateOfBirth: '',
    address: '',
    ktpImage: '',
    selfieImage: '',
  });

  useEffect(() => {
    const checkKycStatus = async () => {
      try {
        const response = await fetch('/api/kyc');
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        const data = await response.json();
        setKycStatus(data.kycStatus || 'PENDING');
      } catch (error) {
        console.error('Error checking KYC status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkKycStatus();
  }, [router]);

  const handleAutoFill = () => {
    setFormData({
      nik: '3201234567890001',
      placeOfBirth: 'Jakarta',
      dateOfBirth: '1990-01-15',
      address: 'Jl. Contoh No. 123, Jakarta Selatan',
      ktpImage: 'placeholder-ktp.jpg',
      selfieImage: 'placeholder-selfie.jpg',
    });
  };

  const handleVerify = async () => {
    setVerificationState('verifying');

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const response = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setVerificationState('success');
        setKycStatus('VERIFIED');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationState('idle');
    }
  };

  if (loading) {
    return <LoadingState text="Memuat data KYC..." />;
  }

  if (kycStatus === 'VERIFIED' && verificationState !== 'success') {
    return (
      <Stack
        maw={640}
        mx="auto"
        py="xl"
        px="md"
        style={{ minHeight: '100vh', justifyContent: 'center' }}
      >
        <Paper p="xl" withBorder>
          <Stack align="center" gap="md">
            <IconCheck size={64} color="green" />
            <Title order={2}>KYC Terverifikasi</Title>
            <Text c="dimmed" ta="center">
              Identitas Anda sudah terverifikasi. Anda dapat mulai berinvestasi.
            </Text>
            <Button onClick={() => router.push('/app')} mt="md">
              Mulai Investasi
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack
      maw={640}
      mx="auto"
      py="xl"
      px="md"
      style={{ minHeight: '100vh', justifyContent: 'center' }}
    >
      <Stack gap="md">
        <Paper p="md" withBorder bg="blue.0">
          <Text size="sm" fw={500}>
            Lengkapi identitas Anda untuk mulai investasi
          </Text>
        </Paper>

        {verificationState === 'success' ? (
          <Paper p="xl" withBorder>
            <Stack align="center" gap="md">
              <IconCheck size={64} color="green" />
              <Title order={2}>Verifikasi berhasil!</Title>
              <Text c="dimmed" ta="center">
                Identitas Anda telah terverifikasi. Selamat berinvestasi!
              </Text>
              <Button onClick={() => router.push('/app')} mt="md">
                Mulai Investasi
              </Button>
            </Stack>
          </Paper>
        ) : verificationState === 'verifying' ? (
          <Paper p="xl" withBorder>
            <Stack align="center" gap="md">
              <LoadingState text="Sedang diverifikasi..." />
            </Stack>
          </Paper>
        ) : (
          <Paper p="xl" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={3}>Data KYC</Title>
                <Button variant="light" onClick={handleAutoFill}>
                  Isi Otomatis (Demo)
                </Button>
              </Group>

              <TextInput
                label="NIK"
                placeholder="Nomor Induk Kependudukan"
                value={formData.nik}
                onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                required
              />

              <Group grow>
                <TextInput
                  label="Tempat Lahir"
                  placeholder="Jakarta"
                  value={formData.placeOfBirth}
                  onChange={(e) => setFormData({ ...formData, placeOfBirth: e.target.value })}
                  required
                />

                <TextInput
                  label="Tanggal Lahir"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  required
                />
              </Group>

              <TextInput
                label="Alamat Lengkap"
                placeholder="Alamat sesuai KTP"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />

              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Foto KTP
                </Text>
                {formData.ktpImage ? (
                  <Paper p="sm" withBorder bg="gray.0">
                    <Text size="sm" c="dimmed">
                      {formData.ktpImage}
                    </Text>
                  </Paper>
                ) : (
                  <Button variant="light" leftSection={<IconUpload size={16} />}>
                    Unggah Foto KTP
                  </Button>
                )}
              </Stack>

              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Foto Selfie dengan KTP
                </Text>
                {formData.selfieImage ? (
                  <Paper p="sm" withBorder bg="gray.0">
                    <Text size="sm" c="dimmed">
                      {formData.selfieImage}
                    </Text>
                  </Paper>
                ) : (
                  <Button variant="light" leftSection={<IconUpload size={16} />}>
                    Unggah Foto Selfie
                  </Button>
                )}
              </Stack>

              <Button
                onClick={handleVerify}
                fullWidth
                mt="md"
                disabled={
                  !formData.nik ||
                  !formData.placeOfBirth ||
                  !formData.dateOfBirth ||
                  !formData.address
                }
              >
                Verifikasi Sekarang
              </Button>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}
