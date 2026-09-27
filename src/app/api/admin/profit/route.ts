import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@/lib/auth';
import { calcProfitSplit } from '@/lib/calculations';
import { prisma } from '@/lib/prisma';

/**
 * Pembagian profit Raia/Investor (default 60/40) diambil dari tabel Setting:
 * raia_share_percent & investor_share_percent.
 *
 * Catatan jujur: model ProfitDistribution tidak punya kolom adminFee,
 * jadi biaya admin tidak dipotong di sini. Key secondary_admin_fee_* hanya
 * berlaku untuk secondary market.
 */

const SPLIT_KEYS = ['raia_share_percent', 'investor_share_percent'] as const;
const DEFAULT_RAIA_PERCENT = 60;
const DEFAULT_INVESTOR_PERCENT = 40;

const createSchema = z.object({
  packageId: z.string().min(1, 'Paket wajib dipilih'),
  amount: z
    .number({ message: 'Nominal harus berupa angka' })
    .int('Nominal harus bilangan bulat')
    .positive('Nominal harus lebih dari 0'),
  source: z.enum(['OFFSPRING', 'MILK', 'OTHER']).default('OFFSPRING'),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Periode harus format YYYY-MM')
    .optional(),
  note: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
});

const actionSchema = z.object({
  action: z.enum(['distribute', 'markPaid']),
  id: z.string().min(1, 'ID distribusi wajib diisi'),
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

async function getSplitSettings(): Promise<{
  raiaPercent: number;
  investorPercent: number;
  error?: string;
}> {
  const rows = await prisma.setting.findMany({
    where: { id: { in: [...SPLIT_KEYS] } },
  });
  const map = new Map(rows.map((row) => [row.id, row.value]));

  const raiaPercent = Number.parseInt(
    map.get('raia_share_percent') ?? String(DEFAULT_RAIA_PERCENT),
    10
  );
  const investorPercent = Number.parseInt(
    map.get('investor_share_percent') ?? String(DEFAULT_INVESTOR_PERCENT),
    10
  );

  if (!Number.isFinite(raiaPercent) || !Number.isFinite(investorPercent)) {
    return { raiaPercent: 0, investorPercent: 0, error: 'Pengaturan pembagian profit tidak valid' };
  }
  if (raiaPercent + investorPercent !== 100) {
    return {
      raiaPercent,
      investorPercent,
      error: `Total pembagian profit harus 100% (Raia ${raiaPercent}% + Investor ${investorPercent}% = ${raiaPercent + investorPercent}%)`,
    };
  }

  return { raiaPercent, investorPercent };
}

function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
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
    const period = searchParams.get('period');

    const where: Record<string, unknown> = {};
    if (status && ['PENDING', 'DISTRIBUTED'].includes(status)) where.status = status;
    if (period && /^\d{4}-\d{2}$/.test(period)) where.period = period;

    const [rows, total] = await Promise.all([
      prisma.profitDistribution.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { package: { select: { code: true, title: true } } },
      }),
      prisma.profitDistribution.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        packageId: row.packageId,
        packageCode: row.package.code,
        packageTitle: row.package.title,
        source: row.source,
        grossAmount: row.grossAmount,
        raiaShare: row.raiaShare,
        investorShare: row.investorShare,
        period: row.period,
        status: row.status,
        note: row.note,
        distributedAt: row.distributedAt,
        createdAt: row.createdAt,
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('GET /api/admin/profit error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat data distribusi profit' },
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

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Format data tidak valid' },
        { status: 400 }
      );
    }

    // Aksi perubahan status: tandai sudah dibagikan
    const actionParse = actionSchema.safeParse(body);
    if (actionParse.success) {
      const updated = await prisma.profitDistribution.update({
        where: { id: actionParse.data.id },
        data: {
          status: 'DISTRIBUTED',
          distributedAt: new Date(),
        },
      });
      return NextResponse.json(updated);
    }

    const validation = createSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error:
            validation.error.issues[0]?.message || 'Data tidak valid',
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { packageId, amount, source, period, note } = validation.data;

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

    const split = await getSplitSettings();
    if (split.error) {
      return NextResponse.json({ error: split.error }, { status: 400 });
    }

    const { raia, investor } = calcProfitSplit(amount, split.raiaPercent);

    const created = await prisma.profitDistribution.create({
      data: {
        packageId,
        source,
        grossAmount: amount,
        raiaShare: raia,
        investorShare: investor,
        period: period ?? currentPeriod(),
        status: 'PENDING',
        note: note ?? null,
      },
    });

    return NextResponse.json(
      {
        ...created,
        split: { raiaPercent: split.raiaPercent, investorPercent: split.investorPercent },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/admin/profit error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat distribusi profit' },
      { status: 500 }
    );
  }
}
