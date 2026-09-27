import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@/lib/auth';
import { formatRupiah } from '@/lib/calculations';
import { prisma } from '@/lib/prisma';

/**
 * Klaim Ta'awun.
 *
 * Schema punya model TaawunClaim (packageId, claimAmount, reason, status)
 * tetapi TIDAK punya kolom userId. Klaim dicatat dua tempat supaya investor
 * teridentifikasi jujur:
 *  - TaawunClaim  -> paket, nominal, alasan, status (jejak klaim)
 *  - Transaction  -> type TAAWUN_CLAIM, status PAID, orderId = TAAWUN-<claimId>
 * Keduanya ditautkan lewat orderId, dan saldo investor dikredit 100%
 * (tanpa pembagian 60/40) ke InvestorBalance.availableBalance.
 */

const RATE_YEAR_1_KEY = 'taawun_year_1';
const RATE_YEAR_2_KEY = 'taawun_year_2_plus';
const DEFAULT_RATE_YEAR_1 = 300000;
const DEFAULT_RATE_YEAR_2 = 150000;

const claimSchema = z.object({
  userId: z.string().min(1, 'Investor wajib dipilih'),
  packageId: z.string().min(1, 'Paket wajib dipilih'),
  amount: z
    .number({ message: 'Jumlah klaim harus berupa angka' })
    .int('Jumlah klaim harus bilangan bulat')
    .positive('Jumlah klaim harus lebih dari 0'),
  year: z
    .number({ message: 'Tahun ke- harus berupa angka' })
    .int('Tahun ke- harus bilangan bulat')
    .min(1, 'Tahun ke- minimal 1')
    .max(60, 'Tahun ke- maksimal 60')
    .optional(),
  reason: z.string().max(500, 'Alasan maksimal 500 karakter').optional(),
});

function deny(error: unknown): NextResponse {
  const code = (error as { code?: string })?.code;
  if (code === 'UNAUTHENTICATED') {
    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu' },
      { status: 401 }
    );
  }
  return NextResponse.json(
    { error: 'Anda tidak memiliki akses ke halaman operator' },
    { status: 403 }
  );
}

async function getRates(): Promise<{ year1: number; year2: number }> {
  const rows = await prisma.setting.findMany({
    where: { id: { in: [RATE_YEAR_1_KEY, RATE_YEAR_2_KEY] } },
  });
  const map = new Map(rows.map((row) => [row.id, row.value]));

  const year1 = Number.parseInt(
    map.get(RATE_YEAR_1_KEY) ?? String(DEFAULT_RATE_YEAR_1),
    10
  );
  const year2 = Number.parseInt(
    map.get(RATE_YEAR_2_KEY) ?? String(DEFAULT_RATE_YEAR_2),
    10
  );

  return {
    year1: Number.isFinite(year1) ? year1 : DEFAULT_RATE_YEAR_1,
    year2: Number.isFinite(year2) ? year2 : DEFAULT_RATE_YEAR_2,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch (error) {
    return deny(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(searchParams.get('pageSize') || '10', 10) || 10)
    );
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status && ['SUBMITTED', 'APPROVED', 'PAID', 'REJECTED'].includes(status)) {
      where.status = status;
    }

    const [claims, total, transactions] = await Promise.all([
      prisma.taawunClaim.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { package: { select: { code: true, title: true, startDate: true } } },
      }),
      prisma.taawunClaim.count({ where }),
      prisma.transaction.findMany({
        where: { type: 'TAAWUN_CLAIM', orderId: { startsWith: 'TAAWUN-' } },
        select: { orderId: true, userId: true, amount: true, status: true },
      }),
    ]);

    const claimOrderIds = new Set(claims.map((claim) => `TAAWUN-${claim.id}`));
    const investorIds = Array.from(
      new Set(
        transactions
          .filter((tx) => claimOrderIds.has(tx.orderId))
          .map((tx) => tx.userId)
      )
    );
    const users = await prisma.user.findMany({
      where: { id: { in: investorIds } },
      select: { id: true, name: true, username: true },
    });

    const txByClaimId = new Map(
      transactions.map((tx) => [tx.orderId.replace('TAAWUN-', ''), tx])
    );
    const userById = new Map(users.map((u) => [u.id, u]));

    const items = claims.map((claim) => {
      const tx = txByClaimId.get(claim.id);
      const investor = tx ? userById.get(tx.userId) : undefined;
      const start = claim.package.startDate
        ? new Date(claim.package.startDate).getTime()
        : null;
      const yearNumber = start
        ? Math.min(
            60,
            Math.floor((new Date(claim.createdAt).getTime() - start) / (365 * 24 * 60 * 60 * 1000)) + 1
          )
        : null;

      return {
        id: claim.id,
        packageCode: claim.package.code,
        packageTitle: claim.package.title,
        investorId: tx?.userId ?? null,
        investorName: investor
          ? investor.name || investor.username
          : 'Tidak tercatat',
        claimAmount: claim.claimAmount,
        reason: claim.reason,
        status: claim.status,
        yearNumber,
        paidAt: claim.paidAt,
        createdAt: claim.createdAt,
      };
    });

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    console.error('GET /api/admin/taawun error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat data klaim ta\'awun' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch (error) {
    return deny(error);
  }

  try {
    const body = await request.json().catch(() => null);
    const validation = claimSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Data tidak valid' },
        { status: 400 }
      );
    }

    const { userId, packageId, amount, year, reason } = validation.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: 'Investor tidak ditemukan' },
        { status: 404 }
      );
    }

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      select: { id: true },
    });
    if (!pkg) {
      return NextResponse.json(
        { error: 'Paket tidak ditemukan' },
        { status: 404 }
      );
    }

    if (year !== undefined) {
      const rates = await getRates();
      const maxAmount = year === 1 ? rates.year1 : rates.year2;
      if (amount > maxAmount) {
        return NextResponse.json(
          {
            error: `Jumlah klaim melebihi batas ta'awun tahun ke-${year} (${formatRupiah(maxAmount)})`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.taawunClaim.create({
        data: {
          packageId,
          claimAmount: amount,
          reason: reason ?? null,
          status: 'PAID',
          approvedAt: now,
          paidAt: now,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          orderId: `TAAWUN-${claim.id}`,
          userId,
          packageId,
          type: 'TAAWUN_CLAIM',
          status: 'PAID',
          amount,
          adminFee: 0,
          paidAt: now,
        },
      });

      // Klaim ta'awun dibayar penuh ke investor — tanpa pembagian 60/40.
      await tx.investorBalance.upsert({
        where: { userId },
        update: { availableBalance: { increment: amount } },
        create: { userId, availableBalance: amount },
      });

      return { claim, transaction };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/taawun error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses klaim ta\'awun' },
      { status: 500 }
    );
  }
}
