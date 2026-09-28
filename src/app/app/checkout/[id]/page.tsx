'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  List,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { formatRupiah } from '@/lib/calculations';

type OwnershipType = 'FULL' | 'LOT';

interface PackageDetail {
  id: string;
  code: string;
  title: string;
  animalType: string;
  price: number;
  lotPrice: number;
  totalLots: number;
  soldLots: number;
  status: string;
  description: string | null;
  estimatedRoi: string | null;
  periodMonths: number | null;
  siteProject: { name: string; legalEntity: string } | null;
}

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        callbacks?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

const MIN_LOTS = 5;

function readModeFromUrl(): OwnershipType {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'lot') return 'LOT';
  }
  return 'FULL';
}

interface Issue {
  message: string;
  kyc?: boolean;
}

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ownership, setOwnership] = useState<OwnershipType>(() => readModeFromUrl());
  const [lots, setLots] = useState<number | string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [pkgRes, kycRes] = await Promise.all([
          fetch(`/api/packages/${id}`),
          fetch('/api/kyc'),
        ]);

        if (!pkgRes.ok) {
          if (!cancelled) setLoadError('Paket tidak ditemukan atau tidak tersedia.');
          return;
        }

        const pkgData = await pkgRes.json();
        const kycData = kycRes.ok ? await kycRes.json() : { kycStatus: 'PENDING' };

        if (cancelled) return;
        setPkg(pkgData);
        setKycStatus(kycData.kycStatus ?? 'PENDING');
        setLots(Math.max(MIN_LOTS, Math.ceil(50000 / pkgData.lotPrice)));
      } catch {
        if (!cancelled) setLoadError('Gagal memuat data paket. Coba lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Muat snap.js hanya bila client key tersedia
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    if (!key || typeof document === 'undefined') return;
    if (document.getElementById('midtrans-snap-script')) return;
    const script = document.createElement('script');
    script.id = 'midtrans-snap-script';
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', key);
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const remaining = pkg ? Math.max(0, pkg.totalLots - pkg.soldLots) : 0;
  const lotsNumber = typeof lots === 'number' ? lots : Number(lots);
  const subtotal = pkg && Number.isFinite(lotsNumber) && lotsNumber > 0
    ? lotsNumber * pkg.lotPrice
    : 0;

  const issue: Issue | null = (() => {
    if (!pkg) return null;
    if (kycStatus !== 'VERIFIED') {
      return {
        message: 'KYC belum terverifikasi. Selesaikan verifikasi terlebih dahulu.',
        kyc: true,
      };
    }
    if (pkg.status !== 'OPEN') {
      return { message: 'Paket tidak tersedia untuk pembelian.' };
    }
    if (ownership === 'FULL') {
      if (pkg.soldLots > 0) return { message: 'Paket penuh sudah terjual.' };
      return null;
    }
    if (lots === '' || !Number.isFinite(lotsNumber) || lotsNumber <= 0) {
      return { message: 'Jumlah lot wajib diisi.' };
    }
    if (lotsNumber < MIN_LOTS) {
      return { message: `Minimal ${MIN_LOTS} lot per transaksi.` };
    }
    if (lotsNumber > remaining) {
      return { message: `Hanya tersisa ${remaining} lot.` };
    }
    if (subtotal < 50000) {
      return { message: 'Minimum pembelian Rp50.000.' };
    }
    return null;
  })();

  const handlePay = useCallback(async () => {
    if (!pkg || issue || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          ownershipType: ownership,
          ...(ownership === 'LOT' ? { lotCount: lotsNumber } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Terjadi kesalahan saat checkout.');
        return;
      }

      // Hanya navigasi bila redirectUrl berupa string non-kosong; selain itu
      // pengguna ditawarkan tautan yang bisa diklik (tidak ada /undefined).
      const redirectUrl =
        typeof data.redirectUrl === 'string' && data.redirectUrl.trim() !== ''
          ? data.redirectUrl
          : null;

      if (data.simulate) {
        // Mode simulasi: tanpa Snap, langsung ke halaman simulasi internal.
        if (!redirectUrl) {
          setSubmitError('Halaman simulasi pembayaran tidak tersedia.');
          return;
        }
        setFallbackUrl(redirectUrl);
        try {
          window.location.href = redirectUrl;
        } catch {
          // jsdom / browser menolak navigasi: link fallback tersedia
        }
        return;
      }

      if (window.snap?.pay && data.snapToken) {
        window.snap.pay(data.snapToken, {
          onSuccess: () => setPaid(true),
          onPending: () => setPaid(true),
          onError: () =>
            setSubmitError('Pembayaran gagal. Silakan coba lagi.'),
          onClose: () =>
            setSubmitError('Pembayaran dibatalkan. Pesanan Anda masih menunggu pembayaran.'),
        });
        return;
      }

      if (!redirectUrl) {
        setSubmitError('Halaman pembayaran tidak tersedia.');
        return;
      }

      setFallbackUrl(redirectUrl);
      try {
        window.location.href = redirectUrl;
      } catch {
        // jsdom / browser menolak navigasi: link fallback tersedia
      }
    } catch {
      setSubmitError('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }, [pkg, issue, submitting, ownership, lotsNumber]);

  if (loading) {
    return (
      <Stack gap="md">
        <Skeleton height={28} width="60%" />
        <Skeleton height={200} />
        <Skeleton height={120} />
      </Stack>
    );
  }

  if (loadError || !pkg) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        color="red"
        title="Gagal memuat"
      >
        {loadError || 'Paket tidak ditemukan.'}{' '}
        <Link href={`/app/paket/${id}`}>Kembali ke detail paket</Link>
      </Alert>
    );
  }

  if (paid) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <ThemeIcon size={48} radius="xl" color="green" variant="light">
            <IconCircleCheck size={28} />
          </ThemeIcon>
          <Title order={3}>Pembayaran diproses</Title>
          <Text c="dimmed" ta="center">
            Terima kasih. Pesanan Anda sedang menunggu konfirmasi pembayaran.
          </Text>
          <Button component={Link} href="/app/transaksi" miw={200} mih={44}>
            Lihat transaksi saya
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={3}>Checkout</Title>
        <Text c="dimmed" size="sm">
          {pkg.code} — {pkg.title}
        </Text>
      </div>

      {issue && (
        <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Tidak dapat melanjutkan">
          <Group gap="xs">
            <span>{issue.message}</span>
            {issue.kyc && (
              <Link href="/kyc">Selesaikan KYC</Link>
            )}
          </Group>
        </Alert>
      )}

      {submitError && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Checkout gagal">
          <Group gap="xs">
            <span>{submitError}</span>
            <Link href="/app/transaksi">Lihat transaksi saya</Link>
          </Group>
        </Alert>
      )}

      {fallbackUrl && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" title="Pembayaran online">
          Tidak dapat membuka halaman pembayaran otomatis.{' '}
          <a href={fallbackUrl} target="_blank" rel="noreferrer">
            Buka halaman pembayaran
          </a>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Card withBorder padding="lg" radius="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600}>Ringkasan paket</Text>
              <Badge color="teal" variant="light">
                {pkg.animalType}
              </Badge>
            </Group>
            <Text size="sm">Lokasi: {pkg.siteProject?.name ?? '-'}</Text>
            <Text size="sm">Badan usaha: {pkg.siteProject?.legalEntity ?? '-'}</Text>
            <Text size="sm">
              Harga paket: <b>{formatRupiah(pkg.price)}</b>
            </Text>
            <Text size="sm">
              Harga per lot: <b>{formatRupiah(pkg.lotPrice)}</b>
            </Text>
            <Text size="sm">Sisa slot: {remaining} lot</Text>
            {pkg.estimatedRoi && (
              <Text size="sm">Estimasi imbal hasil: {pkg.estimatedRoi}</Text>
            )}
            {pkg.periodMonths && (
              <Text size="sm">Periode: {pkg.periodMonths} bulan</Text>
            )}
          </Stack>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <div>
              <Text fw={600} mb={4}>
                Metode pembelian
              </Text>
              <SegmentedControl
                fullWidth
                value={ownership}
                onChange={(v) => setOwnership(v as OwnershipType)}
                data={[
                  { label: 'Beli penuh', value: 'FULL' },
                  { label: 'Beli per lot', value: 'LOT' },
                ]}
              />
            </div>

            {ownership === 'LOT' && (
              <NumberInput
                label="Jumlah lot"
                description={`Min. ${MIN_LOTS} lot — subtotal minimal ${formatRupiah(50000)}`}
                value={lots}
                onChange={setLots}
                min={1}
                max={remaining || undefined}
                step={1}
                allowDecimal={false}
                styles={{ input: { minHeight: 44 } }}
              />
            )}

            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="sm">Subtotal</Text>
                <Text fw={700}>
                  {formatRupiah(
                    ownership === 'FULL'
                      ? pkg.price
                      : Number.isFinite(lotsNumber) && lotsNumber > 0
                        ? subtotal
                        : 0
                  )}
                </Text>
              </Group>
              <Group justify="space-between" mb={4}>
                <Text size="sm">Biaya layanan</Text>
                <Text size="sm">{formatRupiah(0)}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                Nilai investasi dikembalikan di akhir periode sesuai realisasi ternak.
              </Text>
            </Box>

            <Button
              onClick={handlePay}
              disabled={!!issue}
              loading={submitting}
              mih={44}
              size="md"
            >
              Bayar sekarang
            </Button>

            <Text size="xs" c="dimmed">
              Pembayaran diproses oleh Midtrans (Sandbox). Setelah bayar, pantau status di{' '}
              <Link href="/app/transaksi">halaman transaksi</Link>.
            </Text>

            <Button
              variant="light"
              color="gray"
              component={Link}
              href={`/app/paket/${pkg.id}`}
              mih={44}
            >
              Kembali ke detail paket
            </Button>
          </Stack>
        </Card>
      </SimpleGrid>

      <List
        size="sm"
        spacing="xs"
        icon={
          <ThemeIcon color="teal" size={20} radius="xl">
            <IconCircleCheck size={12} />
          </ThemeIcon>
        }
      >
        <List.Item>Pembelian per lot minimal 5 lot.</List.Item>
        <List.Item>Nilai transaksi minimum Rp50.000.</List.Item>
        <List.Item>KYC wajib terverifikasi sebelum checkout.</List.Item>
        <List.Item>Pembelian penuh hanya tersedia bila belum ada yang terjual.</List.Item>
      </List>
    </Stack>
  );
}
