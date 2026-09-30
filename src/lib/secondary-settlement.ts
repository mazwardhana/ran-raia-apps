import type { Prisma } from '@prisma/client';

/**
 * Menyelesaikan pembelian secondary yang sudah lunas.
 *
 * Arah kepemilikan: `transaction.userId` adalah PEMBELI (dibuat Task 3 dengan
 * `userId: user.id`), sedangkan PENJUAL adalah `listing.sellerId`. Pembayaran
 * tidak memindahkan aset; hanya `completeSecondaryPurchase` yang melakukannya.
 *
 * Penjual hanya dikredit sebesar `listingPrice - adminFee`. Fee tetap menjadi
 * pendapatan platform, sama seperti perhitungan di POST /api/secondary/buy.
 *
 * Harus dipanggil di dalam `$transaction` pemanggil supaya klaim status, pindah
 * aset, dan kredit saldo tidak terpisah. Bila transfer aset gagal (mis. baris
 * lot penjual tidak ada), error me-rollback seluruh transaksi sehingga pesanan
 * tidak pernah ditandai PAID tanpa aset berpindah.
 */
export async function completeSecondaryPurchase(
  tx: Prisma.TransactionClient,
  transactionId: string,
  paymentChannel?: string | null
): Promise<void> {
  const transaction = await tx.transaction.findUnique({
    where: { id: transactionId },
    include: { secondaryListing: true },
  });

  if (!transaction) {
    throw new Error('Transaksi tidak ditemukan');
  }

  const listing = transaction.secondaryListing;
  if (!listing) {
    throw new Error('Transaksi bukan pembelian secondary');
  }

  // Gerbang atomik: klaim eksklusif atas pesanan PENDING. Harus berada sebelum
  // perpindahan aset agar pembalap yang kalah (callback ganda) tidak pernah
  // memindahkan aset atau mengkredit saldo dua kali.
  const claimed = await tx.transaction.updateMany({
    where: { id: transactionId, status: 'PENDING' },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      paymentChannel: paymentChannel ?? null,
    },
  });

  if (claimed.count === 0) return;

  const buyerId = transaction.userId;
  const sellerId = listing.sellerId;

  if (listing.ownershipType === 'FULL') {
    const sellerOwnership = await tx.fullOwnership.findFirst({
      where: { packageId: listing.packageId, userId: sellerId },
    });

    if (!sellerOwnership) {
      throw new Error('Kepemilikan FULL penjual tidak ditemukan');
    }

    await tx.fullOwnership.update({
      where: { id: sellerOwnership.id },
      data: { userId: buyerId },
    });
  } else {
    if (listing.lotStart === null || listing.lotEnd === null) {
      throw new Error('Rentang lot listing tidak lengkap');
    }

    const sellerOwnership = await tx.lotOwnership.findFirst({
      where: {
        packageId: listing.packageId,
        userId: sellerId,
        lotStart: listing.lotStart,
        lotEnd: listing.lotEnd,
      },
    });

    if (!sellerOwnership) {
      throw new Error('Kepemilikan lot penjual tidak ditemukan');
    }

    await tx.lotOwnership.update({
      where: { id: sellerOwnership.id },
      data: { userId: buyerId },
    });
  }

  await tx.secondarySale.create({
    data: {
      listingId: listing.id,
      buyerId,
      adminFee: transaction.adminFee,
      finalPrice: listing.listingPrice,
    },
  });

  // Transisi status ber-guard; listing hanya boleh SOLD dari PENDING_PAYMENT.
  await tx.secondaryListing.updateMany({
    where: { id: listing.id, status: 'PENDING_PAYMENT' },
    data: { status: 'SOLD', soldAt: new Date() },
  });

  const sellerPayout = listing.listingPrice - transaction.adminFee;
  await tx.investorBalance.upsert({
    where: { userId: sellerId },
    create: {
      userId: sellerId,
      availableBalance: sellerPayout,
      withdrawnBalance: 0,
      totalEarned: sellerPayout,
    },
    update: {
      availableBalance: { increment: sellerPayout },
      totalEarned: { increment: sellerPayout },
    },
  });
}

/**
 * Melepas pembelian secondary yang gagal/kedaluwarsa.
 *
 * Mengembalikan listing ke ACTIVE dan membatalkan transaksi, tanpa menyentuh
 * kepemilikan atau saldo — aset tidak pernah berpindah sebelum settlement.
 * Mengikuti pola `releaseReservation`: gerbangnya adalah `updateMany`
 * ber-predikat `status: 'PENDING'` sehingga aman dipanggil berulang/bersamaan.
 */
export async function releaseSecondaryPending(
  tx: Prisma.TransactionClient,
  transactionId: string,
  finalStatus: 'CANCELLED' | 'EXPIRED' = 'CANCELLED'
): Promise<void> {
  const transaction = await tx.transaction.findUnique({
    where: { id: transactionId },
  });

  // Pra-pengecekan murah; keputusan tetap di gerbang atomik di bawah.
  if (!transaction || transaction.status !== 'PENDING') return;

  const listingId = transaction.secondaryListingId;

  const claimed = await tx.transaction.updateMany({
    where: { id: transactionId, status: 'PENDING' },
    data: { status: finalStatus, secondaryListingId: null },
  });

  if (claimed.count === 0) return;

  if (listingId) {
    await tx.secondaryListing.updateMany({
      where: { id: listingId, status: 'PENDING_PAYMENT' },
      data: { status: 'ACTIVE' },
    });
  }
}
