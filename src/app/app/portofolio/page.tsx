import { Badge, Box, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/EmptyState';
import { getCurrentUser } from '@/lib/auth';
import { formatRupiah } from '@/lib/calculations';
import { prisma } from '@/lib/prisma';

interface OwnershipItem {
  id: string;
  type: 'LOT' | 'FULL';
  packageId: string;
  acquiredPrice: number;
  invested: number;
  profit: number;
}

export default async function PortofolioPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <EmptyState
        title="Belum ada investasi"
        description="Silakan login untuk melihat portofolio Anda."
      />
    );
  }

  const [lots, fulls, allPackages, profits] = await Promise.all([
    prisma.lotOwnership.findMany({ where: { userId: user.id } }),
    prisma.fullOwnership.findMany({ where: { userId: user.id } }),
    prisma.package.findMany(),
    prisma.profitDistribution.findMany(),
  ]);

  // package.findMany bisa mengembalikan paket di luar kepemilikan user,
  // jadi filter berdasarkan id yang benar-benar dimiliki.
  const ownedPackageIds = new Set<string>([
    ...lots.map((lot: { packageId: string }) => lot.packageId),
    ...fulls.map((full: { packageId: string }) => full.packageId),
  ]);
  const packageMap = new Map(
    allPackages
      .filter((pkg) => ownedPackageIds.has(pkg.id))
      .map((pkg) => [pkg.id, pkg] as [string, typeof pkg])
  );

  const profitByPackage = new Map<string, number>();
  for (const dist of profits as Array<{ packageId: string; investorShare: number }>) {
    profitByPackage.set(
      dist.packageId,
      (profitByPackage.get(dist.packageId) ?? 0) + dist.investorShare
    );
  }

  const items: OwnershipItem[] = [
    ...(lots as Array<{
      id: string;
      packageId: string;
      lotStart: number;
      lotEnd: number;
      acquiredPrice: number;
    }>).map((lot) => ({
      id: lot.id,
      type: 'LOT' as const,
      packageId: lot.packageId,
      invested: lot.acquiredPrice * (lot.lotEnd - lot.lotStart + 1),
      acquiredPrice: lot.acquiredPrice,
      profit: profitByPackage.get(lot.packageId) ?? 0,
    })),
    ...(fulls as Array<{
      id: string;
      packageId: string;
      acquiredPrice: number;
    }>).map((full) => ({
      id: full.id,
      type: 'FULL' as const,
      packageId: full.packageId,
      invested: full.acquiredPrice,
      acquiredPrice: full.acquiredPrice,
      profit: profitByPackage.get(full.packageId) ?? 0,
    })),
  ];

  if (items.length === 0) {
    return (
      <EmptyState
        title="Belum ada investasi"
        description="Anda belum memiliki paket investasi. Mulai dari katalog paket."
      />
    );
  }

  const totalInvested = items.reduce((sum, item) => sum + item.invested, 0);
  const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);
  const uniquePackages = new Set(items.map((item) => item.packageId)).size;

  const metrics = [
    { label: 'Total Nilai Investasi', value: formatRupiah(totalInvested) },
    { label: 'Total Perkiraan Laba', value: formatRupiah(totalProfit) },
    { label: 'Jumlah Paket Dimiliki', value: String(uniquePackages) },
    { label: 'Jumlah Kepemilikan', value: String(items.length) },
  ];

  return (
    <Stack gap="lg" py="md">
      <div>
        <Text fw={700} size="xl">
          Portofolio Saya
        </Text>
        <Text size="sm" c="dimmed">
          Ringkasan seluruh kepemilikan investasi ternak Anda.
        </Text>
      </div>

      <Box bg="white" p="md" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {metrics.map((metric) => (
            <Card key={metric.label} withBorder padding="md" radius="md">
              <Text size="xs" c="dimmed">
                {metric.label}
              </Text>
              <Text fw={700} size="lg">
                {metric.value}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </Box>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {items.map((item) => {
          const pkg = packageMap.get(item.packageId);
          return (
            <Card
              key={`${item.type}-${item.id}`}
              className="card-hover"
              withBorder
              component={Link}
              href={`/app/portofolio/${item.id}`}
              aria-label={`Lihat detail kepemilikan ${pkg ? pkg.title : 'paket'}`}
              padding="lg"
              radius="md"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Text fw={700}>{pkg ? pkg.title : 'Paket'}</Text>
                  <Badge>{item.type === 'LOT' ? 'LOT' : 'FULL'}</Badge>
                </Group>

                {pkg && (
                  <Text size="sm" c="dimmed">
                    {pkg.animalType} • {formatRupiah(pkg.price ?? 0)}
                  </Text>
                )}

                <Stack gap={6}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Harga beli
                    </Text>
                    <Text size="sm" fw={600}>
                      {formatRupiah(item.acquiredPrice)}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Nilai investasi
                    </Text>
                    <Text size="sm" fw={600}>
                      {formatRupiah(item.invested)}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Perkiraan laba
                    </Text>
                    <Text size="sm" fw={600} c="teal.7">
                      {formatRupiah(item.profit)}
                    </Text>
                  </Group>
                </Stack>

                <Text
                  c="teal.7"
                  fw={600}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    minHeight: 44,
                    fontSize: 14,
                  }}
                >
                  Lihat Detail
                </Text>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
