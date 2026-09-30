import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { settleWithdrawal } from '@/lib/withdrawal';

const actionSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'PAID'], {
    errorMap: () => ({ message: 'Aksi penarikan tidak valid' }),
  }),
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

/**
 * Persetujuan/pembayaran penarikan oleh operator.
 *
 * Dana sudah dikunci saat pengajuan, jadi `APPROVED`/`PAID` hanya memindahkan
 * status; `REJECTED` mengembalikan saldo. Transisi yang tidak sah dipetakan ke
 * 409, bukan 500, supaya operator tahu statusnya sudah berubah.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let user;
  try {
    user = await requireRole(['ADMIN', 'OPERATOR']);
  } catch (error) {
    return deny(error);
  }

  const body = await request.json().catch(() => null);
  const validation = actionSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || 'Data tidak valid' },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction((tx) =>
      settleWithdrawal(tx, params.id, validation.data.action, user.id)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSISI_TIDAK_SAH') {
      return NextResponse.json(
        { error: 'Status penarikan tidak sesuai untuk aksi ini' },
        { status: 409 }
      );
    }

    console.error('PATCH /api/admin/withdrawals/[id] error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses penarikan' },
      { status: 500 }
    );
  }
}
