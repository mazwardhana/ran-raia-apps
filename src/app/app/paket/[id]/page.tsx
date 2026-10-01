import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Title,
} from '@mantine/core';
import dayjs from 'dayjs';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { PackageImage } from '@/components/ui/PackageImage';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupiah } from '@/lib/calculations';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const COST_LABELS: Record<string, string> = {
  ANIMAL: 'Biaya ternak',
  TAAWUN: "Dana ta'awun",
  RENT: 'Sewa kandang',
  FEED: 'Pakan',
  LABOR: 'Tenaga kerja',
  MEDICINE: 'Obat dan vaksin',
  OPERATIONAL: 'Operasional lain',
};

const MIN_CHECKOUT = 50000;

export default async function PackageDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const pkg = await prisma.package.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      code: true,
      title: true,
      animalType: true,
      price: true,
      lotPrice: true,
      totalLots: true,
      soldLots: true,
      status: true,
      coverImage: true,
      description: true,
      estimatedRoi: true,
      estimatedOffspring: true,
      estimatedOffspringPrice: true,
      estimatedMilkMonthly: true,
      estimatedMilkPrice: true,
      periodMonths: true,
      startDate: true,
      endDate: true,
      siteProject: {
        select: {
          id: true,
          name: true,
          legalEntity: true,
          address: true,
          province: true,
          city: true,
        },
      },
      costs: {
        select: { costType: true, amount: true, description: true },
        orderBy: { amount: 'desc' as const },
      },
    },
  });

  if (!pkg || pkg.status === 'DRAFT') {
    notFound();
  }

  const totalCost = pkg.costs.reduce((sum, cost) => sum + cost.amount, 0);
  const percent =
    pkg.totalLots > 0
      ? Math.min(100, Math.round((pkg.soldLots / pkg.totalLots) * 100))
      : 0;
  const buyable = pkg.status === 'OPEN' || pkg.status === 'RUNNING';
  const minLotCount = Math.ceil(MIN_CHECKOUT / pkg.lotPrice);

  return (
    <Box p="md">
      <Stack gap="lg">
        <PackageImage
          src={pkg.coverImage}
          animalType={pkg.animalType}
          alt={`Ilustrasi ${pkg.animalType === 'KAMBING' ? 'kambing' : 'sapi'} paket ${pkg.title}`}
          height={220}
          radius="md"
        />

        <Stack gap="xs">
          <Title order={1}>{pkg.title}</Title>
          <Group gap="xs">
            <StatusBadge status={pkg.status} />
            <Badge variant="light" color="teal">
              {pkg.animalType === 'KAMBING' ? 'Kambing' : 'Sapi'}
            </Badge>
            <Text size="sm" c="dimmed">
              {pkg.code}
            </Text>
          </Group>
        </Stack>

        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={700} size="lg">
                {formatRupiah(pkg.price)}
              </Text>
              <Text size="sm" c="dimmed">
                {formatRupiah(pkg.lotPrice)} / lot
              </Text>
            </Group>

            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="sm">
                  {pkg.soldLots.toLocaleString('id-ID')} /{' '}
                  {pkg.totalLots.toLocaleString('id-ID')} lot terjual
                </Text>
                <Text size="sm" fw={600}>
                  {percent}%
                </Text>
              </Group>
              <Progress value={percent} size="lg" radius="xl" />
            </Box>
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Site project
            </Text>
            <Text fw={500}>{pkg.siteProject.name}</Text>
            <Text size="sm" c="dimmed">
              Badan usaha: {pkg.siteProject.legalEntity}
            </Text>
            <Text size="sm" c="dimmed">
              {pkg.siteProject.address}, {pkg.siteProject.city},{' '}
              {pkg.siteProject.province}
            </Text>
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Komposisi biaya
            </Text>
            <Box style={{ overflowX: 'auto' }}>
              <Table>
                <TableThead>
                  <TableTr>
                    <TableTh>Komponen</TableTh>
                    <TableTh>Keterangan</TableTh>
                    <TableTh ta="right">Jumlah</TableTh>
                  </TableTr>
                </TableThead>
                <TableTbody>
                  {pkg.costs.map((cost) => (
                    <TableTr key={cost.costType}>
                      <TableTd>{COST_LABELS[cost.costType] || cost.costType}</TableTd>
                      <TableTd c="dimmed">{cost.description || '—'}</TableTd>
                      <TableTd ta="right">{formatRupiah(cost.amount)}</TableTd>
                    </TableTr>
                  ))}
                  <TableTr>
                    <TableTd fw={700}>Total komposisi biaya</TableTd>
                    <TableTd />
                    <TableTd ta="right" fw={700}>
                      {formatRupiah(totalCost)}
                    </TableTd>
                  </TableTr>
                </TableTbody>
              </Table>
            </Box>
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Estimasi return
            </Text>
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
              <Box>
                <Text size="xs" c="dimmed">
                  ROI
                </Text>
                <Text size="sm" fw={500}>
                  {pkg.estimatedRoi != null ? `ROI ${pkg.estimatedRoi}%` : '—'}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">
                  Anak ternak per periode
                </Text>
                <Text size="sm" fw={500}>
                  {pkg.estimatedOffspring != null && pkg.estimatedOffspringPrice != null
                    ? `${pkg.estimatedOffspring} ekor × ${formatRupiah(pkg.estimatedOffspringPrice)}`
                    : '—'}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">
                  Susu per bulan
                </Text>
                <Text size="sm" fw={500}>
                  {pkg.estimatedMilkMonthly != null && pkg.estimatedMilkPrice != null
                    ? `${pkg.estimatedMilkMonthly} liter × ${formatRupiah(pkg.estimatedMilkPrice)}`
                    : '—'}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed">
                  Periode
                </Text>
                <Text size="sm" fw={500}>
                  {pkg.periodMonths} bulan
                </Text>
              </Box>
            </SimpleGrid>
            {pkg.startDate && pkg.endDate && (
              <Text size="xs" c="dimmed">
                {dayjs(pkg.startDate).format('DD MMM YYYY')} –{' '}
                {dayjs(pkg.endDate).format('DD MMM YYYY')}
              </Text>
            )}
          </Stack>
        </Card>

        {pkg.description && (
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Deskripsi
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                {pkg.description}
              </Text>
            </Stack>
          </Card>
        )}

        <Card withBorder>
          <Stack gap="md">
            {buyable ? (
              <>
                <Button
                  component={Link}
                  href={`/app/checkout/${pkg.id}`}
                  size="lg"
                  fullWidth
                  style={{ minHeight: 44 }}
                >
                  Beli Paket Utuh
                </Button>
                <Button
                  component={Link}
                  href={`/app/checkout/${pkg.id}?mode=lot`}
                  size="lg"
                  fullWidth
                  variant="light"
                  style={{ minHeight: 44 }}
                >
                  Beli Lot
                </Button>
                <Text size="xs" c="dimmed" ta="center">
                  Minimum pembelian {minLotCount} lot (
                  {formatRupiah(MIN_CHECKOUT)}) per transaksi.
                </Text>
              </>
            ) : (
              <>
                <Button size="lg" fullWidth disabled style={{ minHeight: 44 }}>
                  {pkg.status === 'SOLD_OUT' ? 'Paket habis terjual' : 'Paket ditutup'}
                </Button>
                <Text size="xs" c="dimmed" ta="center">
                  {pkg.status === 'SOLD_OUT'
                    ? 'Semua slot pada paket ini sudah dimiliki.'
                    : 'Pembelian pada paket ini sudah ditutup.'}
                </Text>
              </>
            )}
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}
