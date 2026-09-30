import { NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Daftar permintaan penarikan untuk konsol operator.
 *
 * Status difilter opsional lewat `?status=`. Pengguna yang mengajukan di-join
 * manual (tanpa `include`) supaya bentuk responsnya datar dan mudah dirender
 * tabel: `username`/`name` menempel di tiap baris.
 */

const STATUSES = ['PENDING', 'APPROVED', 'PAID', 'REJECTED'] as const;

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

export async function GET(request: NextRequest) {
  try {
    await requireRole(['ADMIN', 'OPERATOR']);
  } catch (error) {
    return deny(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status && (STATUSES as readonly string[]).includes(status)) {
      where.status = status;
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const userIds = Array.from(new Set(withdrawals.map((row) => row.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, name: true },
    });
    const userMap = new Map(users.map((user) => [user.id, user]));

    return NextResponse.json({
      withdrawals: withdrawals.map((row) => ({
        id: row.id,
        amount: row.amount,
        status: row.status,
        bankName: row.bankName,
        bankAccount: row.bankAccount,
        bankHolder: row.bankHolder,
        note: row.note,
        createdAt: row.createdAt,
        approvedAt: row.approvedAt,
        paidAt: row.paidAt,
        username: userMap.get(row.userId)?.username ?? null,
        name: userMap.get(row.userId)?.name ?? null,
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/withdrawals error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat daftar penarikan' },
      { status: 500 }
    );
  }
}
