import { Box, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { ErrorState } from '@/components/ui/ErrorState';
import { requireRole } from '@/lib/auth';
import { formatRupiah } from '@/lib/calculations';
import { prisma } from '@/lib/prisma';

import { TaawunClient } from './TaawunClient';
import type { TaawunInvestor, TaawunMetrics, TaawunPackage, TaawunRow } from './TaawunClient';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Diajukan',
  APPROVED: 'Disetujui',
  PAID: 'Dibayar',
  REJECTED: 'Ditolak',
};

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export default async function OperatorTaawunPage() {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch {
    redirect('/');
  }

  try {
    const [claims, claimsPaid, collected, txs, rate1Row, rate2Row, investors, packages] =
      await Promise.all([
        prisma.taawunClaim.findMany({
          orderBy: { createdAt: 'desc' },
          take: 200,
          include: { package: { select: { code: true, title: true, startDate: true } } },
        }),
        prisma.taawunClaim.aggregate({
          where: { status: 'PAID' },
          _sum: { claimAmount: true },
          _count: true,
        }),
        prisma.packageCost.aggregate({
          where: { costType: 'TAAWUN' },
          _sum: { amount: true },
        }),
        prisma.transaction.findMany({
          where: { type: 'TAAWUN_CLAIM', orderId: { startsWith: 'TAAWUN-' } },
          select: { orderId: true, userId: true },
        }),
        prisma.setting.findUnique({ where: { id: 'taawun_year_1' } }),
        prisma.setting.findUnique({ where: { id: 'taawun_year_2_plus' } }),
        prisma.user.findMany({
          where: { role: 'INVESTOR' },
          select: { id: true, name: true, username: true },
          orderBy: { name: 'asc' },
          take: 500,
        }),
        prisma.package.findMany({
          where: { status: { not: 'DRAFT' } },
          select: { id: true, code: true, title: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      ]);

    const rate1 = Number.parseInt(rate1Row?.value ?? '300000', 10);
    const rate2 = Number.parseInt(rate2Row?.value ?? '150000', 10);
    const rates = {
      year1: Number.isFinite(rate1) ? rate1 : 300000,
      year2: Number.isFinite(rate2) ? rate2 : 150000,
    };

    const txByClaimId = new Map(
      txs.map((tx) => [tx.orderId.replace('TAAWUN-', ''), tx.userId])
    );
    const userMap = new Map(
      investors.map((u) => [u.id, u.name || u.username])
    );

    const rows: TaawunRow[] = claims.map((claim) => {
      const investorId = txByClaimId.get(claim.id);
      const start = claim.package.startDate
        ? new Date(claim.package.startDate).getTime()
        : null;
      const yearNumber = start
        ? Math.min(
            60,
            Math.floor((new Date(claim.createdAt).getTime() - start) / YEAR_MS) + 1
          )
        : null;

      return {
        id: claim.id,
        investor: investorId
          ? userMap.get(investorId) ?? 'Tidak tercatat'
          : 'Tidak tercatat',
        paket: `${claim.package.code} · ${claim.package.title}`,
        jumlah: formatRupiah(claim.claimAmount),
        tahun: yearNumber ? `Tahun ke-${yearNumber}` : '—',
        status: claim.status,
        statusLabel: STATUS_LABEL[claim.status] ?? claim.status,
        alasan: claim.reason ?? '-',
        dibuat: new Date(claim.createdAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      };
    });

    const metrics: TaawunMetrics = {
      terkumpul: collected._sum.amount ?? 0,
      terkumpulAdaData: (collected._sum.amount ?? 0) > 0,
      diklaim: claimsPaid._sum.claimAmount ?? 0,
      diklaimCount: claimsPaid._count,
      totalBaris: claims.length,
    };

    const investorOptions: TaawunInvestor[] = investors.map((u) => ({
      value: u.id,
      label: u.name || u.username,
    }));
    const packageOptions: TaawunPackage[] = packages.map((p) => ({
      value: p.id,
      label: `${p.code} · ${p.title}`,
    }));

    return (
      <Box p="md">
        <Stack gap="md">
          <div>
            <Title order={1}>Klaim Ta&apos;awun</Title>
            <Text size="sm" c="dimmed">
              Ta&apos;awun dibayar penuh (100%) ke saldo investor, tanpa
              pembagian profit. Rate: tahun ke-1{' '}
              {formatRupiah(rates.year1)}, tahun ke-2 ke atas{' '}
              {formatRupiah(rates.year2)}.
            </Text>
          </div>
          <TaawunClient
            rows={rows}
            metrics={metrics}
            rates={rates}
            investors={investorOptions}
            packages={packageOptions}
          />
        </Stack>
      </Box>
    );
  } catch (error) {
    console.error('Gagal memuat halaman taawun:', error);
    return (
      <Box p="md">
        <Stack gap="md">
          <Title order={1}>Klaim Ta&apos;awun</Title>
          <ErrorState
            title="Gagal memuat klaim ta'awun"
            description="Data tidak dapat diambil dari server. Muat ulang halaman untuk mencoba lagi."
          />
        </Stack>
      </Box>
    );
  }
}
