'use client';

import {
  Box,
  Button,
  Card,
  Group,
  Image,
  Progress,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconFilter, IconSearch, IconSearchOff } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BaseModal } from '@/components/ui/BaseModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupiah } from '@/lib/calculations';

interface PackageItem {
  id: string;
  code: string;
  title: string;
  animalType: 'KAMBING' | 'SAPI';
  price: number;
  lotPrice: number;
  totalLots: number;
  soldLots: number;
  status: string;
  coverImage: string | null;
  estimatedRoi: number | null;
  periodMonths: number;
  siteProject: {
    id: string;
    name: string;
    legalEntity: string;
    city: string;
    province: string;
  };
}

interface Filters {
  status: string;
  animalType: string;
  siteId: string;
}

const EMPTY_FILTERS: Filters = { status: '', animalType: '', siteId: '' };

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Terbuka' },
  { value: 'RUNNING', label: 'Berjalan' },
  { value: 'CLOSED', label: 'Selesai' },
  { value: 'SOLD_OUT', label: 'Habis' },
];

const ANIMAL_OPTIONS = [
  { value: 'KAMBING', label: 'Kambing' },
  { value: 'SAPI', label: 'Sapi' },
];

function packageProgress(item: PackageItem) {
  if (item.totalLots <= 0) return 0;
  return Math.min(100, Math.round((item.soldLots / item.totalLots) * 100));
}

export default function CatalogPage() {
  const [items, setItems] = useState<PackageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sites, setSites] = useState<{ value: string; label: string }[]>([]);
  const [filterOpened, setFilterOpened] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftAnimal, setDraftAnimal] = useState('');
  const [draftSite, setDraftSite] = useState('');
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.status) params.set('status', filters.status);
      if (filters.animalType) params.set('animalType', filters.animalType);
      if (filters.siteId) params.set('siteId', filters.siteId);

      const res = await fetch(`/api/packages?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Gagal memuat paket (kode ${res.status})`);
      }
      const json = await res.json();
      if (seq !== requestSeq.current) return; // respons basi, abaikan

      const list: PackageItem[] = json.items ?? [];
      setItems(list);
      setTotal(json.total ?? list.length);
      setSites((prev) => {
        const seen = new Map(prev.map((s) => [s.value, s]));
        list.forEach((pkg) => {
          if (!seen.has(pkg.siteProject.id)) {
            seen.set(pkg.siteProject.id, {
              value: pkg.siteProject.id,
              label: pkg.siteProject.name,
            });
          }
        });
        return Array.from(seen.values());
      });
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : 'Tidak dapat memuat data');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [debouncedSearch, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const openFilter = () => {
    setDraftStatus(filters.status);
    setDraftAnimal(filters.animalType);
    setDraftSite(filters.siteId);
    setFilterOpened(true);
  };

  const applyFilter = () => {
    setFilters({
      status: draftStatus,
      animalType: draftAnimal,
      siteId: draftSite,
    });
    setFilterOpened(false);
  };

  const resetFilter = () => {
    setDraftStatus('');
    setDraftAnimal('');
    setDraftSite('');
    setFilters(EMPTY_FILTERS);
    setFilterOpened(false);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const hasQuery = Boolean(debouncedSearch) || activeFilterCount > 0;

  return (
    <Box p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={1}>Katalog Paket</Title>
          {!loading && !error && (
            <Text size="sm" c="dimmed">
              {total} paket
            </Text>
          )}
        </Group>

        <Group align="flex-end" gap="xs" wrap="nowrap">
          <TextInput
            label="Cari paket"
            placeholder="Cari nama atau kode paket..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
            styles={{ input: { minHeight: 44 } }}
          />
          <Button
            leftSection={<IconFilter size={16} />}
            variant={activeFilterCount > 0 ? 'filled' : 'default'}
            onClick={openFilter}
            style={{ minHeight: 44 }}
          >
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        </Group>

        {loading ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {[0, 1, 2].map((i) => (
              <Card key={i} withBorder>
                <Skeleton height={160} />
                <Skeleton height={20} width="70%" mt="md" />
                <Skeleton height={14} width="50%" mt="xs" />
              </Card>
            ))}
          </SimpleGrid>
        ) : error ? (
          <ErrorState description={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Belum ada paket"
            description={
              hasQuery
                ? 'Tidak ada paket yang cocok dengan pencarian atau filter Anda.'
                : 'Belum ada paket investasi yang tersedia saat ini.'
            }
            icon={<IconSearchOff size={48} stroke={1.5} />}
            action={
              hasQuery
                ? { label: 'Reset filter', onClick: () => { setSearch(''); resetFilter(); } }
                : undefined
            }
          />
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {items.map((pkg) => {
              const percent = packageProgress(pkg);
              return (
                <Card
                  key={pkg.id}
                  withBorder
                  padding="sm"
                  component={Link}
                  href={`/app/paket/${pkg.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 44,
                  }}
                >
                  {pkg.coverImage ? (
                    <Image
                      src={pkg.coverImage}
                      alt={`Foto paket ${pkg.title}`}
                      height={160}
                      fit="cover"
                      radius="sm"
                    />
                  ) : (
                    <Box
                      h={160}
                      style={{
                        borderRadius: 'var(--mantine-radius-sm)',
                        backgroundColor: 'var(--mantine-color-gray-1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text size="sm" c="dimmed">
                        {pkg.animalType === 'KAMBING' ? 'Kambing' : 'Sapi'}
                      </Text>
                    </Box>
                  )}

                  <Stack gap={6} mt="sm" style={{ flex: 1 }}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Text fw={600} lineClamp={2}>
                        {pkg.title}
                      </Text>
                      <StatusBadge status={pkg.status} />
                    </Group>
                    <Text size="xs" c="dimmed">
                      {pkg.siteProject.name} · {pkg.siteProject.city}
                    </Text>
                    <Text size="lg" fw={700}>
                      {formatRupiah(pkg.price)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatRupiah(pkg.lotPrice)} / lot · {pkg.periodMonths} bulan
                    </Text>

                    <Box>
                      <Group justify="space-between" mb={4}>
                        <Text size="xs" c="dimmed">
                          {pkg.soldLots.toLocaleString('id-ID')} /{' '}
                          {pkg.totalLots.toLocaleString('id-ID')} lot
                        </Text>
                        {pkg.estimatedRoi != null && (
                          <Text size="xs" fw={600} c="teal">
                            ROI {pkg.estimatedRoi}%
                          </Text>
                        )}
                      </Group>
                      <Progress
                        value={percent}
                        size="md"
                        radius="xl"
                        aria-label={`Slot terjual ${percent}%`}
                      />
                    </Box>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>

      <BaseModal
        opened={filterOpened}
        onClose={() => setFilterOpened(false)}
        title="Filter paket"
        size="md"
      >
        <Stack gap="md">
          <SearchableSelect
            label="Site project"
            placeholder="Semua site"
            data={sites}
            value={draftSite}
            onChange={(v) => setDraftSite(v ?? '')}
            clearable
          />
          <SearchableSelect
            label="Jenis ternak"
            placeholder="Semua jenis"
            data={ANIMAL_OPTIONS}
            value={draftAnimal}
            onChange={(v) => setDraftAnimal(v ?? '')}
            clearable
          />
          <Select
            label="Status"
            placeholder="Semua status"
            data={STATUS_OPTIONS}
            value={draftStatus}
            onChange={(v) => setDraftStatus(v ?? '')}
            clearable
            styles={{ input: { minHeight: 44 } }}
          />
          <Group justify="space-between" mt="md">
            <Button
              variant="light"
              color="gray"
              onClick={resetFilter}
              style={{ minHeight: 44 }}
            >
              Reset
            </Button>
            <Button onClick={applyFilter} style={{ minHeight: 44 }}>
              Terapkan filter
            </Button>
          </Group>
        </Stack>
      </BaseModal>
    </Box>
  );
}
