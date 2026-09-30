import type { Prisma } from '@prisma/client';

export interface PayoutLine {
  userId: string;
  amount: number;
}

/**
 * orderId deterministik untuk payout profit. `orderId` unik di tabel Transaction
 * sehingga kredit ganda untuk distribusi yang sama akan ditolak database
 * (P2002), bukan diam-diam menambah saldo dua kali.
 */
export function payoutOrderId(distId: string, userId: string): string {
  return `PAYOUT-${distId}-${userId}`;
}

/**
 * Bagi `investorShare` ke pemilik paket.
 *
 * - Bila ada pemilik FULL, dialah pemilik seluruh paket → satu baris penuh.
 * - Selain itu pro-rata per lot: `floor(investorShare * lotCount / totalLots)`.
 *   Baris bernilai nol dibuang; sisa pembulatan tidak dibagikan (tetap di
 *   platform) agar jumlah kredit tidak pernah melebihi `investorShare`.
 */
export function splitInvestorShare(params: {
  investorShare: number;
  totalLots: number;
  lotOwners: { userId: string; lotStart: number; lotEnd: number }[];
  fullOwners: { userId: string }[];
}): PayoutLine[] {
  const { investorShare, totalLots, lotOwners, fullOwners } = params;

  if (fullOwners.length > 0) {
    return [{ userId: fullOwners[0].userId, amount: investorShare }];
  }

  if (totalLots <= 0) return [];

  return lotOwners
    .map((owner) => {
      const lotCount = owner.lotEnd - owner.lotStart + 1;
      const amount = Math.floor((investorShare * lotCount) / totalLots);
      return { userId: owner.userId, amount };
    })
    .filter((line) => line.amount > 0);
}

/**
 * Menandai distribusi profit sebagai DISTRIBUTED dan mengkredit saldo investor.
 *
 * Harus dipanggil di dalam `$transaction` pemanggil supaya klaim status dan
 * kredit tidak terpisah. Idempotensi berlapis:
 *  1. Klaim ber-guard `status: 'PENDING'` — pemanggil kedua mendapat count 0.
 *  2. `orderId @unique` — bila kredit terlanjur ada, create melempar P2002 dan
 *     seluruh `$transaction` rollback (tidak ditelan).
 *
 * @returns `true` bila klaim berhasil (kredit dijalankan), `false` bila sudah
 *          pernah didistribusikan.
 */
export async function distributeAndCredit(
  tx: Prisma.TransactionClient,
  distributionId: string
): Promise<boolean> {
  const claimed = await tx.profitDistribution.updateMany({
    where: { id: distributionId, status: 'PENDING' },
    data: { status: 'DISTRIBUTED', distributedAt: new Date() },
  });

  if (claimed.count === 0) return false;

  const distribution = await tx.profitDistribution.findUnique({
    where: { id: distributionId },
  });
  if (!distribution) {
    throw new Error('Distribusi profit tidak ditemukan');
  }

  const pkg = await tx.package.findUnique({
    where: { id: distribution.packageId },
    select: { totalLots: true },
  });

  const [lotOwners, fullOwners] = await Promise.all([
    tx.lotOwnership.findMany({
      where: { packageId: distribution.packageId },
      select: { userId: true, lotStart: true, lotEnd: true },
    }),
    tx.fullOwnership.findMany({
      where: { packageId: distribution.packageId },
      select: { userId: true },
    }),
  ]);

  const lines = splitInvestorShare({
    investorShare: distribution.investorShare,
    totalLots: pkg?.totalLots ?? 0,
    lotOwners,
    fullOwners,
  });

  for (const line of lines) {
    await tx.transaction.create({
      data: {
        orderId: payoutOrderId(distributionId, line.userId),
        userId: line.userId,
        packageId: distribution.packageId,
        type: 'PAYOUT',
        status: 'PAID',
        amount: line.amount,
        adminFee: 0,
        paidAt: new Date(),
      },
    });

    await tx.investorBalance.upsert({
      where: { userId: line.userId },
      create: {
        userId: line.userId,
        availableBalance: line.amount,
        withdrawnBalance: 0,
        totalEarned: line.amount,
      },
      update: {
        availableBalance: { increment: line.amount },
        totalEarned: { increment: line.amount },
      },
    });
  }

  return true;
}
