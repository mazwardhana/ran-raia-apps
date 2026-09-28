import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export interface LotRange {
  lotStart: number;
  lotEnd: number;
}

/**
 * Rentang nomor lot yang baru dikuasai satu pesanan.
 *
 * `soldLots` adalah jumlah lot yang sudah terjual **sebelum** pesanan ini,
 * jadi lot pertama yang dikuasai adalah `soldLots + 1` (bukan `soldLots`).
 * Sama dengan rumus di `prisma/seed.ts` (`lotsAssigned + 1`).
 */
export function calcLotRange(soldLots: number, requestedLots: number): LotRange {
  return {
    lotStart: soldLots + 1,
    lotEnd: soldLots + requestedLots,
  };
}

/**
 * Lepas satu reservasi pesanan yang masih PENDING.
 *
 * Mengembalikan slot lot (`soldLots`), menghapus baris kepemilikan milik
 * pesanan itu, lalu menyetel statusnya. Idempoten: pemanggilan kedua tidak
 * berpengaruh karena status sudah bukan PENDING lagi.
 *
 * Harus dipanggil dengan Prisma transaction client supaya perubahan slot dan
 * status tidak terpisah.
 */
export async function releaseReservation(
  tx: Prisma.TransactionClient,
  transactionId: string,
  finalStatus: 'CANCELLED' | 'EXPIRED' = 'CANCELLED'
): Promise<void> {
  const transaction = await tx.transaction.findUnique({
    where: { id: transactionId },
    include: {
      package: { select: { totalLots: true } },
      lotOwnership: true,
      fullOwnership: true,
    },
  });

  if (!transaction || transaction.status !== 'PENDING') return;

  // Untuk pembelian FULL, lotCount bernilai null sehingga slot yang dipegang
  // adalah seluruh totalLots paket.
  const lotsToRelease =
    transaction.lotCount ??
    (transaction.fullOwnership ? transaction.package.totalLots : 0);

  if (lotsToRelease > 0) {
    await tx.package.update({
      where: { id: transaction.packageId },
      data: { soldLots: { decrement: lotsToRelease } },
    });
  }

  await tx.lotOwnership.deleteMany({ where: { transactionId } });
  await tx.fullOwnership.deleteMany({ where: { transactionId } });

  await tx.transaction.update({
    where: { id: transactionId },
    data: { status: finalStatus },
  });
}

/**
 * Sapu pesanan PENDING yang sudah melewati `expiredAt`.
 *
 * Mengikuti pola `expireStaleListings()`: dipanggil oportunistik dari route
 * yang membaca data, bukan dari cron (proyek ini tidak punya cron). Satu
 * pesanan yang gagal tidak menghentikan sisanya, dan kegagalan kueri tidak
 * pernah melempar ke pemanggil.
 */
export async function expireStaleTransactions(): Promise<void> {
  try {
    const staleTransactions = await prisma.transaction.findMany({
      where: {
        status: 'PENDING',
        expiredAt: { lt: new Date() },
      },
      select: { id: true },
    });

    for (const { id } of staleTransactions) {
      try {
        await prisma.$transaction((tx) =>
          releaseReservation(tx, id, 'EXPIRED')
        );
      } catch (error) {
        console.error(`Gagal melepas pesanan kedaluwarsa ${id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error expiring stale transactions:', error);
  }
}
