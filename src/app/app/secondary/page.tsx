'use client';

import {
  Alert,
  Box,
  Button,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupiah } from '@/lib/calculations';

interface ListingRow {
  id: string;
  listingPrice: number;
  expiresAt: string;
  listedAt: string;
  status: string;
  isMine: boolean;
  ownershipType: 'FULL' | 'LOT';
  lotStart: number | null;
  lotEnd: number | null;
  seller: { id: string; username: string; name: string };
  package: {
    id: string;
    code: string;
    title: string;
    price: number;
    animalType: string;
    siteProject: { name: string };
  } | null;
}

interface MyOwnershipRow {
  ownershipId: string;
  ownershipType: 'FULL' | 'LOT';
  packageId: string;
  packageTitle: string;
  packageCode: string;
  parPrice: number;
  lotStart: number | null;
  lotEnd: number | null;
  acquiredAt: string;
  listed: boolean;
}

function sisaWaktu(expiresAt: string, now: number): string {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return 'Kedaluwarsa';
  const jam = Math.floor(diff / 3600000);
  const hari = Math.floor(jam / 24);
  const sisaJam = jam % 24;
  if (hari > 0) return `${hari} hari ${sisaJam} jam`;
  if (jam > 0) return `${jam} jam`;
  const menit = Math.floor(diff / 60000);
  return `${menit} menit`;
}

export default function SecondaryPage() {
  const router = useRouter();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [myAssets, setMyAssets] = useState<MyOwnershipRow[]>([]);
  const [listingDays, setListingDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [buyTarget, setBuyTarget] = useState<ListingRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ListingRow | null>(null);
  const [sellTarget, setSellTarget] = useState<MyOwnershipRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/secondary');
      if (!res.ok) {
        throw new Error(`Gagal memuat listing (kode ${res.status})`);
      }
      const json = await res.json();
      setListings(json.listings ?? []);
      setMyAssets(json.myAssets ?? []);
      if (typeof json.listingDays === 'number') {
        setListingDays(json.listingDays);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tidak dapat memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const submitBuy = async () => {
    if (!buyTarget) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/secondary/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: buyTarget.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal membeli listing');
      }
      setBuyTarget(null);
      if (typeof json.redirectUrl === 'string' && json.redirectUrl.trim() !== '') {
        router.push(json.redirectUrl);
      } else {
        await load();
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal membeli listing');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/secondary/${cancelTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal membatalkan listing');
      }
      setCancelTarget(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal membatalkan listing');
    } finally {
      setSubmitting(false);
    }
  };

  const submitSell = async () => {
    if (!sellTarget) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/secondary/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownershipType: sellTarget.ownershipType,
          ownershipId: sellTarget.ownershipId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal membuat listing');
      }
      setSellTarget(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Gagal membuat listing');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box p="md">
        <LoadingState />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="md">
        <ErrorState description={error} onRetry={load} />
      </Box>
    );
  }

  return (
    <Box p="md">
      <Stack gap="xl">
        <section aria-labelledby="judul-listing">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={1} id="judul-listing">
                Listing Aktif
              </Title>
              <Text size="sm" c="gray.7">
                {listings.length} listing
              </Text>
            </Group>

            {listings.length === 0 ? (
              <EmptyState
                title="Belum ada listing"
                description="Belum ada aset investor yang dijual di secondary market."
              />
            ) : (
              <Table.ScrollContainer minWidth={640}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Paket</Table.Th>
                      <Table.Th>Penjual</Table.Th>
                      <Table.Th>Harga par</Table.Th>
                      <Table.Th>Sisa waktu</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th aria-label="Aksi" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {listings.map((row) => (
                      <Table.Tr key={row.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {row.package?.title || row.package?.code || '-'}
                          </Text>
                          <Text size="xs" c="gray.7">
                            {row.ownershipType === 'FULL'
                              ? 'Paket utuh'
                              : `Lot ${row.lotStart}-${row.lotEnd}`}
                          </Text>
                        </Table.Td>
                        <Table.Td>{row.seller.name}</Table.Td>
                        <Table.Td>{formatRupiah(row.listingPrice)}</Table.Td>
                        <Table.Td>{sisaWaktu(row.expiresAt, now)}</Table.Td>
                        <Table.Td>
                          <StatusBadge status={row.status ?? 'ACTIVE'} />
                        </Table.Td>
                        <Table.Td>
                          {row.isMine ? (
                            <Button
                              size="xs"
                              variant="default"
                              onClick={() => {
                                setActionError(null);
                                setCancelTarget(row);
                              }}
                              styles={{ root: { minHeight: 44 } }}
                            >
                              Batalkan
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="filled"
                              onClick={() => {
                                setActionError(null);
                                setBuyTarget(row);
                              }}
                              styles={{ root: { minHeight: 44 } }}
                            >
                              Beli
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>
        </section>

        <section aria-labelledby="judul-aset">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={2} id="judul-aset">
                Aset Saya
              </Title>
              <Text size="sm" c="gray.7">
                {myAssets.length} aset
              </Text>
            </Group>

            {myAssets.length === 0 ? (
              <EmptyState
                title="Belum ada aset"
                description="Anda belum memiliki paket. Beli paket terlebih dahulu untuk dapat menjualnya di sini."
              />
            ) : (
              <Table.ScrollContainer minWidth={640}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Paket</Table.Th>
                      <Table.Th>Tipe</Table.Th>
                      <Table.Th>Diperoleh</Table.Th>
                      <Table.Th>Harga par</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th aria-label="Aksi" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {myAssets.map((row) => (
                      <Table.Tr key={row.ownershipId}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {row.packageTitle}
                          </Text>
                          <Text size="xs" c="gray.7">
                            {row.packageCode}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {row.ownershipType === 'FULL'
                            ? 'Paket utuh'
                            : `Lot ${row.lotStart}-${row.lotEnd}`}
                        </Table.Td>
                        <Table.Td>
                          {new Date(row.acquiredAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Table.Td>
                        <Table.Td>{formatRupiah(row.parPrice)}</Table.Td>
                        <Table.Td>
                          {row.listed ? (
                            <StatusBadge status="ACTIVE" label="Dijual" />
                          ) : (
                            <Text size="sm" c="gray.7">
                              Tidak dijual
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant={row.listed ? 'default' : 'filled'}
                            disabled={row.listed}
                            onClick={() => {
                              setActionError(null);
                              setSellTarget(row);
                            }}
                            styles={{ root: { minHeight: 44 } }}
                          >
                            {row.listed ? 'Sedang dijual' : 'Jual'}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>
        </section>
      </Stack>

      <BaseModal
        opened={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Batalkan listing"
        size="xs"
      >
        <Stack gap="md">
          <Text size="sm">
            Tawaran{' '}
            <strong>{cancelTarget?.package?.title || 'paket ini'}</strong> pada
            harga par{' '}
            <strong>
              {cancelTarget ? formatRupiah(cancelTarget.listingPrice) : ''}
            </strong>{' '}
            akan ditarik dari secondary market. Aset tetap menjadi milik Anda.
          </Text>
          {actionError && (
            <Alert color="red" role="alert">
              {actionError}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => setCancelTarget(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button onClick={submitCancel} loading={submitting}>
              Konfirmasi batalkan
            </Button>
          </Group>
        </Stack>
      </BaseModal>

      <BaseModal
        opened={buyTarget !== null}
        onClose={() => setBuyTarget(null)}
        title="Beli listing"
        size="xs"
      >
        <Stack gap="md">
          <Text size="sm">
            Anda akan membeli{' '}
            <strong>{buyTarget?.package?.title || 'paket ini'}</strong> pada
            harga par{' '}
            <strong>{buyTarget ? formatRupiah(buyTarget.listingPrice) : ''}</strong>.
            Setelah konfirmasi, Anda akan diarahkan ke halaman pembayaran untuk
            menyelesaikan transaksi. Kepemilikan berpindah setelah pembayaran
            berhasil.
          </Text>
          {actionError && (
            <Alert color="red" role="alert">
              {actionError}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => setBuyTarget(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button onClick={submitBuy} loading={submitting}>
              Konfirmasi beli
            </Button>
          </Group>
        </Stack>
      </BaseModal>

      <BaseModal
        opened={sellTarget !== null}
        onClose={() => setSellTarget(null)}
        title="Jual aset"
        size="xs"
      >
        <Stack gap="md">
          <Text size="sm">
            Aset <strong>{sellTarget?.packageTitle}</strong> akan dijual pada
            harga par{' '}
            <strong>{sellTarget ? formatRupiah(sellTarget.parPrice) : ''}</strong>{' '}
            selama {listingDays} hari. Jika tidak ada pembeli, Raia mengambil
            alih 100% tanpa potongan.
          </Text>
          {actionError && (
            <Alert color="red" role="alert">
              {actionError}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => setSellTarget(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button onClick={submitSell} loading={submitting}>
              Konfirmasi jual
            </Button>
          </Group>
        </Stack>
      </BaseModal>
    </Box>
  );
}
