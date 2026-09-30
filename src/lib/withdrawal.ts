import type { Prisma, Withdrawal } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export interface WithdrawalDestination {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
}

/**
 * Ajukan penarikan sekaligus **mengunci** dananya.
 *
 * Saldo investor dikurangi di dalam transaksi yang sama dengan pembuatan baris
 * Withdrawal, lewat `updateMany` ber-guard `availableBalance: { gte: amount }`.
 * Guard itu dievaluasi database terhadap versi baris terbaru, jadi dua pengajuan
 * bersaing yang totalnya melebihi saldo hanya bisa sama-sama lolos bila saldo
 * memang cukup — yang kalah mendapat `count === 0` dan tidak pernah membuat
 * baris. Karena dana sudah dikunci di sini, `APPROVED`/`PAID` tidak menyentuh
 * saldo lagi; hanya `REJECTED` yang mengembalikannya.
 */
export async function createWithdrawal(
  userId: string,
  amount: number,
  destination: WithdrawalDestination
): Promise<Withdrawal> {
  return prisma.$transaction(async (tx) => {
    const reserved = await tx.investorBalance.updateMany({
      where: { userId, availableBalance: { gte: amount } },
      data: { availableBalance: { decrement: amount } },
    });

    if (reserved.count === 0) {
      throw new Error('SALDO_TIDAK_CUKUP');
    }

    return tx.withdrawal.create({
      data: {
        userId,
        amount,
        bankName: destination.bankName,
        bankAccount: destination.bankAccount,
        bankHolder: destination.bankHolder,
        status: 'PENDING',
      },
    });
  });
}

/**
 * Mesin status penarikan (RULING 12).
 *
 * Semua transisi memakai `updateMany` ber-guard status lama — tidak pernah
 * `update` — supaya dua operator yang menekan tombol bersamaan tidak bisa
 * memproses satu penarikan dua kali (mis. dua kali refund).
 *
 * - `PENDING → APPROVED`: set `approvedAt`/`approvedById`, saldo tetap.
 * - `PENDING → REJECTED`: kembalikan `availableBalance` + catat `note`.
 * - `APPROVED → PAID`: set `paidAt`, saldo tetap (dana sudah dikunci saat ajuan).
 *
 * Harus dipanggil dengan Prisma transaction client supaya klaim status dan
 * pengembalian saldo tidak terpisah.
 */
export async function settleWithdrawal(
  tx: Prisma.TransactionClient,
  id: string,
  action: 'APPROVED' | 'REJECTED' | 'PAID',
  actorId?: string
): Promise<void> {
  if (action === 'APPROVED') {
    const claimed = await tx.withdrawal.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: actorId ?? null,
      },
    });

    if (claimed.count === 0) throw new Error('TRANSISI_TIDAK_SAH');
    return;
  }

  if (action === 'PAID') {
    const claimed = await tx.withdrawal.updateMany({
      where: { id, status: 'APPROVED' },
      data: { status: 'PAID', paidAt: new Date() },
    });

    if (claimed.count === 0) throw new Error('TRANSISI_TIDAK_SAH');
    return;
  }

  // REJECTED: baca dulu supaya nominal yang dikembalikan pasti nilai sebelum
  // update, bukan hasil baca ulang yang bisa sudah berubah.
  const withdrawal = await tx.withdrawal.findUnique({ where: { id } });

  const claimed = await tx.withdrawal.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'REJECTED', note: 'Ditolak operator' },
  });

  if (claimed.count === 0 || !withdrawal) {
    throw new Error('TRANSISI_TIDAK_SAH');
  }

  await tx.investorBalance.update({
    where: { userId: withdrawal.userId },
    data: { availableBalance: { increment: withdrawal.amount } },
  });
}
