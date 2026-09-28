'use client';

import { Button, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconCheck, IconUpload } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';

interface KYCFormData {
  nik: string;
  placeOfBirth: string;
  dateOfBirth: string;
  address: string;
}

type VerificationState = 'idle' | 'verifying' | 'success';

// PNG 1x1 transparan — dipakai tombol "Isi Otomatis (Demo)" supaya alur demo
// tetap bisa dikirim tanpa memilih berkas asli.
const DEMO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function demoImageFile(filename: string): File {
  const binary = atob(DEMO_PNG_BASE64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: 'image/png' });
}

export default function KycPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string>('PENDING');
  const [verificationState, setVerificationState] = useState<VerificationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ktpImage, setKtpImage] = useState<File | null>(null);
  const [selfieImage, setSelfieImage] = useState<File | null>(null);
  const ktpInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<KYCFormData>({
    nik: '',
    placeOfBirth: '',
    dateOfBirth: '',
    address: '',
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
    });
    setKtpImage(demoImageFile('placeholder-ktp.png'));
    setSelfieImage(demoImageFile('placeholder-selfie.png'));
  };

  const handleVerify = async () => {
    setErrorMessage(null);
    setVerificationState('verifying');

    try {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const body = new FormData();
      body.append('nik', formData.nik);
      body.append('placeOfBirth', formData.placeOfBirth);
      body.append('dateOfBirth', formData.dateOfBirth);
      body.append('address', formData.address);
      if (ktpImage) {
        body.append('ktpImage', ktpImage);
      }
      if (selfieImage) {
        body.append('selfieImage', selfieImage);
      }

      const response = await fetch('/api/kyc', {
        method: 'POST',
        body,
      });

      if (response.ok) {
        setVerificationState('success');
        setKycStatus('VERIFIED');
      } else {
        const data = await response.json().catch(() => null);
        setErrorMessage(data?.error || 'Verifikasi gagal. Silakan coba lagi.');
        setVerificationState('idle');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setErrorMessage('Terjadi kesalahan saat mengirim data. Silakan coba lagi.');
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
                <input
                  ref={ktpInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  style={{ display: 'none' }}
                  onChange={(event) => setKtpImage(event.target.files?.[0] ?? null)}
                />
                {ktpImage ? (
                  <Paper p="sm" withBorder bg="gray.0">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {ktpImage.name}
                      </Text>
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => ktpInputRef.current?.click()}
                      >
                        Ganti
                      </Button>
                    </Group>
                  </Paper>
                ) : (
                  <Button
                    variant="light"
                    leftSection={<IconUpload size={16} />}
                    onClick={() => ktpInputRef.current?.click()}
                  >
                    Unggah Foto KTP
                  </Button>
                )}
              </Stack>

              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Foto Selfie dengan KTP
                </Text>
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  style={{ display: 'none' }}
                  onChange={(event) => setSelfieImage(event.target.files?.[0] ?? null)}
                />
                {selfieImage ? (
                  <Paper p="sm" withBorder bg="gray.0">
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        {selfieImage.name}
                      </Text>
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => selfieInputRef.current?.click()}
                      >
                        Ganti
                      </Button>
                    </Group>
                  </Paper>
                ) : (
                  <Button
                    variant="light"
                    leftSection={<IconUpload size={16} />}
                    onClick={() => selfieInputRef.current?.click()}
                  >
                    Unggah Foto Selfie
                  </Button>
                )}
              </Stack>

              {errorMessage && (
                <Text c="red" size="sm">
                  {errorMessage}
                </Text>
              )}

              <Button
                onClick={handleVerify}
                fullWidth
                mt="md"
                disabled={
                  !formData.nik ||
                  !formData.placeOfBirth ||
                  !formData.dateOfBirth ||
                  !formData.address ||
                  !ktpImage ||
                  !selfieImage
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
