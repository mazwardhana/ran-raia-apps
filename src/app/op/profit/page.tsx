import { Box, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { ErrorState } from '@/components/ui/ErrorState';
import { requireRole } from '@/lib/auth';
import { formatRupiah } from '@/lib/calculations';
import { prisma } from '@/lib/prisma';

import { ProfitClient } from './ProfitClient';
import type { ChartPoint, ProfitMetrics, ProfitRow } from './ProfitClient';

export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  OFFSPRING: 'Anak',
  MILK: 'Susu',
  OTHER: 'Lainnya',
};

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default async function OperatorProfitPage() {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch {
    redirect('/');
  }

  const period = currentPeriod();

  try {
    const [rows, distributed, pending, raiaRow, investorRow] =
      await Promise.all([
        prisma.profitDistribution.findMany({
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: { package: { select: { code: true, title: true } } },
        }),
        prisma.profitDistribution.aggregate({
          where: { status: 'DISTRIBUTED', period },
          _sum: { grossAmount: true, investorShare: true },
          _count: true,
        }),
        prisma.profitDistribution.aggregate({
          where: { status: 'PENDING' },
          _sum: { grossAmount: true },
          _count: true,
        }),
        prisma.setting.findUnique({ where: { id: 'raia_share_percent' } }),
        prisma.setting.findUnique({ where: { id: 'investor_share_percent' } }),
      ]);

    const raiaPercentParsed = Number.parseInt(raiaRow?.value ?? '60', 10);
    const investorPercentParsed = Number.parseInt(investorRow?.value ?? '40', 10);
    const shares = {
      raiaPercent: Number.isFinite(raiaPercentParsed) ? raiaPercentParsed : 60,
      investorPercent: Number.isFinite(investorPercentParsed)
        ? investorPercentParsed
        : 40,
    };

    const metrics: ProfitMetrics = {
      period,
      didistribusikan: distributed._sum.grossAmount ?? 0,
      didistribusikanCount: distributed._count,
      bagianInvestor: distributed._sum.investorShare ?? 0,
      menunggu: pending._sum.grossAmount ?? 0,
      menungguCount: pending._count,
      totalBaris: rows.length,
    };

    const profitRows: ProfitRow[] = rows.map((row) => ({
      id: row.id,
      packageId: row.packageId,
      periode: row.period,
      paket: `${row.package.code} · ${row.package.title}`,
      sumber: SOURCE_LABEL[row.source] ?? row.source,
      nilaiKotor: formatRupiah(row.grossAmount),
      bagianInvestor: formatRupiah(row.investorShare),
      bagianRaia: formatRupiah(row.raiaShare),
      status: row.status,
      statusLabel:
        row.status === 'DISTRIBUTED' ? 'Terbagikan' : 'Menunggu',
      catatan: row.note ?? '-',
      dibuat: new Date(row.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    }));

    // Grafik per periode (bulan) — hanya dari data nyata.
    const byPeriod = new Map<string, { total: number; investor: number }>();
    for (const row of rows) {
      const entry = byPeriod.get(row.period) ?? { total: 0, investor: 0 };
      entry.total += row.grossAmount;
      entry.investor += row.investorShare;
      byPeriod.set(row.period, entry);
    }
    const chartData: ChartPoint[] = Array.from(byPeriod, ([key, value]) => ({
      period: key,
      total: value.total,
      investor: value.investor,
    }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12);

    return (
      <Box p="md">
        <Stack gap="md">
          <div>
            <Title order={1}>Distribusi Profit</Title>
            <Text size="sm" c="dimmed">
              Bagi hasil kotor paket sesuai persentase pengaturan (Raia{' '}
              {shares.raiaPercent}% / Investor {shares.investorPercent}%).
            </Text>
          </div>
          <ProfitClient
            rows={profitRows}
            metrics={metrics}
            chartData={chartData}
            shares={shares}
          />
        </Stack>
      </Box>
    );
  } catch (error) {
    console.error('Gagal memuat halaman distribusi profit:', error);
    return (
      <Box p="md">
        <Stack gap="md">
          <Title order={1}>Distribusi Profit</Title>
          <ErrorState
            title="Gagal memuat distribusi profit"
            description="Data tidak dapat diambil dari server. Muat ulang halaman untuk mencoba lagi."
          />
        </Stack>
      </Box>
    );
  }
}
