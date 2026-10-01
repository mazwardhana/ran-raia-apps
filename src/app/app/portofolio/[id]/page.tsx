import {
  Badge,
  Box,
  Button,
  Card,
  Group,
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
import { LineChart } from '@mantine/charts';
import dayjs from 'dayjs';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupiah } from '@/lib/calculations';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const EVENT_LABELS: Record<string, string> = {
  BIRTH: 'Kelahiran',
  MATING: 'Kawin',
  HEALTH_CHECK: 'Pemeriksaan kesehatan',
  MILK: 'Pemerah susu',
  SALE: 'Penjualan',
  DEATH: 'Kematian',
  VACCINATION: 'Vaksinasi',
  WEIGHT_LOG: 'Timbangan',
};

export default async function OwnershipDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const lot = await prisma.lotOwnership.findFirst({
    where: { id: params.id, userId: user.id },
  });
  const full = lot
    ? null
    : await prisma.fullOwnership.findFirst({
        where: { id: params.id, userId: user.id },
      });

  const ownership = lot ?? full;
  if (!ownership) notFound();

  const pkg = await prisma.package.findUnique({
    where: { id: ownership.packageId },
  });
  if (!pkg) notFound();

  const isLot = lot != null;

  const [events, milkLogs, profits] = await Promise.all([
    prisma.livestockEvent.findMany({
      where: { livestock: { packageId: pkg.id } },
      orderBy: { eventDate: 'desc' },
      take: 10,
      include: { livestock: { select: { tagNumber: true, name: true } } },
    }),
    prisma.milkLog.findMany({
      where: {
        livestock: { packageId: pkg.id },
        logDate: { gte: dayjs().subtract(30, 'day').toDate() },
      },
      orderBy: { logDate: 'asc' },
    }),
    prisma.profitDistribution.findMany({
      where: { packageId: pkg.id },
      orderBy: { period: 'desc' },
    }),
  ]);

  // Gabungkan semua log susu per hari (jumlahkan seluruh ternak dalam paket).
  const milkByDay = new Map<string, number>();
  for (const log of milkLogs) {
    const key = dayjs(log.logDate).format('YYYY-MM-DD');
    const liters = log.totalLt ?? (log.morningLt ?? 0) + (log.eveningLt ?? 0);
    milkByDay.set(key, (milkByDay.get(key) ?? 0) + liters);
  }
  const milkData = Array.from(milkByDay, ([day, liters]) => ({
    day: dayjs(day).format('DD MMM'),
    liters: Math.round(liters * 10) / 10,
  }));

  return (
    <Box p="md">
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={1}>{pkg.title}</Title>
          <Group gap="xs">
            <StatusBadge status={pkg.status} />
            <Badge variant="light" color="teal">
              {pkg.animalType === 'KAMBING' ? 'Kambing' : 'Sapi'}
            </Badge>
            <Badge variant="light" color="gray">
              {isLot ? 'LOT' : 'FULL'}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {isLot
              ? `Lot ${lot!.lotStart}–${lot!.lotEnd}`
              : 'Paket utuh'}
          </Text>
        </Stack>

        <Card withBorder>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Harga perolehan
            </Text>
            <Text fw={700} size="lg">
              {formatRupiah(ownership.acquiredPrice)}
            </Text>
            {isLot && lot!.lotStart != null && (
              <Text size="xs" c="dimmed">
                Dibeli pada {dayjs(lot!.createdAt).format('DD MMM YYYY')}
              </Text>
            )}
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Aktivitas ternak terbaru
            </Text>
            {events.length > 0 ? (
              <Stack gap="sm">
                {events.map((event) => (
                  <Box key={event.id} pl="sm" style={{ borderLeft: '2px solid var(--mantine-color-gray-3)' }}>
                    <Group gap="xs" wrap="wrap">
                      <Text size="sm" fw={600}>
                        {EVENT_LABELS[event.eventType] || event.eventType}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {dayjs(event.eventDate).format('DD MMM YYYY')}
                      </Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {event.livestock.tagNumber}
                      {event.livestock.name ? ` · ${event.livestock.name}` : ''}
                    </Text>
                    {event.description && (
                      <Text size="sm">{event.description}</Text>
                    )}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Belum ada catatan aktivitas ternak.
              </Text>
            )}
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Produksi susu 30 hari terakhir
            </Text>
            {milkData.length > 0 ? (
              <Box style={{ overflowX: 'auto' }}>
                <LineChart
                  h={240}
                  data={milkData}
                  dataKey="day"
                  series={[{ name: 'liters', label: 'Liter', color: 'teal.6' }]}
                  curveType="linear"
                  withLegend={false}
                  gridAxis="xy"
                />
              </Box>
            ) : (
              <Text size="sm" c="dimmed">
                Belum ada pencatatan susu 30 hari terakhir.
              </Text>
            )}
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Distribusi profit
            </Text>
            {profits.length > 0 ? (
              <Table.ScrollContainer minWidth={480}>
                <Table>
                  <TableThead>
                    <TableTr>
                      <TableTh>Periode</TableTh>
                      <TableTh>Sumber</TableTh>
                      <TableTh ta="right">Bagi hasil</TableTh>
                      <TableTh>Status</TableTh>
                    </TableTr>
                  </TableThead>
                  <TableTbody>
                    {profits.map((profit) => (
                      <TableTr key={profit.id}>
                        <TableTd>{profit.period}</TableTd>
                        <TableTd>{profit.source}</TableTd>
                        <TableTd ta="right">
                          {formatRupiah(profit.investorShare)}
                        </TableTd>
                        <TableTd>
                          <StatusBadge status={profit.status} />
                        </TableTd>
                      </TableTr>
                    ))}
                  </TableTbody>
                </Table>
              </Table.ScrollContainer>
            ) : (
              <Text size="sm" c="dimmed">
                Belum ada distribusi profit untuk paket ini.
              </Text>
            )}
          </Stack>
        </Card>

        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <Button
            component={Link}
            href={`/app/secondary?ownershipId=${params.id}`}
            size="lg"
            fullWidth
            style={{ minHeight: 44 }}
          >
            Jual Aset
          </Button>
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
