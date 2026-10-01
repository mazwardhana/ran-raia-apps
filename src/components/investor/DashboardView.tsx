'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { LineChart, PieChart } from '@mantine/charts';
import {
  IconAlertCircle,
  IconChartPie,
  IconCoin,
  IconPackage,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import Link from 'next/link';

import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { formatRupiah } from '@/lib/calculations';

export interface DashboardData {
  totalInvestment: number;
  totalProfit: number;
  totalLots: number;
  portfolioDistribution: Array<{ animalType: 'KAMBING' | 'SAPI'; value: number }>;
  profitTrend: Array<{ period: string; profit: number; createdAt: Date }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    eventDate: Date;
    description: string;
    livestockTag: string;
  }>;
  kycStatus?: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  BIRTH: 'Kelahiran',
  MATING: 'Perkawinan',
  HEALTH_CHECK: 'Pemeriksaan kesehatan',
  MILK: 'Perahan susu',
  SALE: 'Penjualan',
  DEATH: 'Kematian',
  VACCINATION: 'Vaksinasi',
  WEIGHT_LOG: 'Penimbangan',
};

// Fixture demo, hanya dipakai bila data ProfitDistribution kosong.
// Selalu ditandai "Data demo" agar tidak dianggap data nyata.
function buildDemoProfitTrend() {
  const values = [300000, 450000, 380000, 520000, 470000, 400000];
  return values.map((profit, i) => {
    const date = dayjs().subtract(5 - i, 'month');
    return {
      period: date.format('YYYY-MM'),
      profit,
      createdAt: date.toDate(),
    };
  });
}

function buildDemoEvents() {
  return [
    {
      id: 'demo-1',
      eventType: 'BIRTH',
      eventDate: dayjs().subtract(2, 'day').toDate(),
      description: 'Kelahiran ternak (data demo)',
      livestockTag: 'DEMO-001',
    },
    {
      id: 'demo-2',
      eventType: 'HEALTH_CHECK',
      eventDate: dayjs().subtract(5, 'day').toDate(),
      description: 'Pemeriksaan kesehatan rutin (data demo)',
      livestockTag: 'DEMO-002',
    },
    {
      id: 'demo-3',
      eventType: 'MILK',
      eventDate: dayjs().subtract(9, 'day').toDate(),
      description: 'Perahan susu (data demo)',
      livestockTag: 'DEMO-003',
    },
  ];
}

export function DashboardView({ data }: { data: DashboardData }) {
  const pieData = data.portfolioDistribution.map((item) => ({
    name: item.animalType === 'KAMBING' ? 'Kambing' : 'Sapi',
    value: item.value,
    color: item.animalType === 'KAMBING' ? 'teal.6' : 'orange.6',
  }));

  const isDemoProfit = data.profitTrend.length === 0;
  const trendSource = isDemoProfit ? buildDemoProfitTrend() : data.profitTrend;
  const lineData = trendSource.map((item) => ({
    month: dayjs(item.createdAt).format('MMM'),
    profit: item.profit,
  }));

  const isDemoEvents = data.recentEvents.length === 0;
  const events = isDemoEvents ? buildDemoEvents() : data.recentEvents;

  return (
    <Box p="md">
      <Stack gap="lg">
        <Title order={1}>Dashboard</Title>

        {data.kycStatus === 'PENDING' && (
          <Alert
            icon={<IconAlertCircle size={20} />}
            title="Verifikasi identitas Anda"
            color="teal"
            variant="light"
          >
            <Text size="sm" mb="xs">
              Selesaikan verifikasi KYC untuk mulai membeli paket.
            </Text>
            <Button
              component={Link}
              href="/kyc"
              size="sm"
              variant="light"
              color="teal"
              style={{ minHeight: 44 }}
            >
              Verifikasi sekarang
            </Button>
          </Alert>
        )}

        <Box bg="white" p="md" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
            <MetricCard
              icon={<IconCoin size={24} />}
              label="Total Investasi"
              value={formatRupiah(data.totalInvestment)}
            />
            <MetricCard
              icon={<IconChartPie size={24} />}
              label="Total Profit"
              value={formatRupiah(data.totalProfit)}
            />
            <MetricCard
              icon={<IconPackage size={24} />}
              label="Jumlah Lot"
              value={String(data.totalLots)}
            />
          </SimpleGrid>
        </Box>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <ChartCard title="Distribusi portofolio">
            {pieData.length > 0 ? (
              <Box>
                <PieChart
                  data={pieData}
                  withLabelsLine
                  labelsPosition="outside"
                  labelsType="percent"
                  withTooltip
                  tooltipDataSource="segment"
                  mx="auto"
                  size={200}
                />
                <Stack gap="xs" mt="md">
                  {pieData.map((item) => (
                    <Group key={item.name} justify="space-between">
                      <Group gap="xs">
                        <Box
                          w={12}
                          h={12}
                          style={{
                            backgroundColor: `var(--mantine-color-${item.color})`,
                            borderRadius: 2,
                          }}
                        />
                        <Text size="sm">{item.name}</Text>
                      </Group>
                      <Text size="sm" fw={600}>
                        {formatRupiah(item.value)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Box>
            ) : (
              <EmptyState
                title="Belum ada aset"
                description="Beli paket untuk melihat distribusi portofolio Anda."
              />
            )}
          </ChartCard>

          <ChartCard title="Tren profit 6 bulan">
            {lineData.length > 0 ? (
              <Box>
                {isDemoProfit && (
                  <Group justify="flex-end" mb="xs">
                    <Badge size="xs" color="gray" variant="light">
                      Data demo
                    </Badge>
                  </Group>
                )}
                <LineChart
                  h={240}
                  data={lineData}
                  dataKey="month"
                  series={[{ name: 'profit', label: 'Profit', color: 'teal.6' }]}
                  curveType="linear"
                  withLegend={false}
                  gridAxis="xy"
                  valueFormatter={(value) => formatRupiah(value)}
                />
              </Box>
            ) : (
              <EmptyState
                title="Belum ada data profit"
                description="Distribusi profit akan muncul setelah paket berjalan."
              />
            )}
          </ChartCard>
        </SimpleGrid>

        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                Aktivitas ternak terbaru
              </Text>
              {isDemoEvents && (
                <Badge size="sm" color="gray" variant="light">
                  Data demo
                </Badge>
              )}
            </Group>
            {events.length > 0 ? (
              <Stack gap="sm">
                {events.map((event) => (
                  <Box key={event.id}>
                    <Group justify="space-between" wrap="nowrap">
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>
                          {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {event.description}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Tag: {event.livestockTag}
                        </Text>
                      </Box>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {dayjs(event.eventDate).format('DD MMM YYYY')}
                      </Text>
                    </Group>
                  </Box>
                ))}
              </Stack>
            ) : (
              <EmptyState
                title="Belum ada aktivitas"
                description="Aktivitas ternak akan muncul setelah paket berjalan."
              />
            )}
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}
