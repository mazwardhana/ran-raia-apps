import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { releaseSecondaryPending } from '@/lib/secondary-settlement';

/**
 * Calculate the admin fee for a secondary listing.
 * Extracted so both POST /api/secondary/buy (Task 3) and the
 * payment-callback handler (Task 4) can share the same logic.
 *
 * @param listingPrice - The listing price in rupiah
 * @param tx - Prisma client or transaction client
 */
export async function calculateFee(
  listingPrice: number,
  tx: Prisma.TransactionClient
): Promise<{ feePercent: number; feeFlat: number; adminFee: number }> {
  const [feePercentSetting, feeFlatSetting] = await Promise.all([
    tx.setting.findUnique({ where: { id: 'secondary_admin_fee_percent' } }),
    tx.setting.findUnique({ where: { id: 'secondary_admin_fee_flat' } }),
  ]);

  const feePercentRaw = feePercentSetting
    ? parseFloat(feePercentSetting.value)
    : 0;
  const feeFlatRaw = feeFlatSetting
    ? parseInt(feeFlatSetting.value, 10)
    : 0;
  const feePercent =
    Number.isFinite(feePercentRaw) && feePercentRaw > 0 ? feePercentRaw : 0;
  const feeFlat =
    Number.isInteger(feeFlatRaw) && feeFlatRaw > 0 ? feeFlatRaw : 0;

  const adminFee =
    feeFlat + Math.floor((listingPrice * feePercent) / 100);

  return { feePercent, feeFlat, adminFee };
}

/**
 * Expire stale listings that have passed their expiry time.
 * 
 * Runs cron-style: called on read operations (GET /api/secondary).
 * Changes status from ACTIVE to TAKEOVER for expired listings,
 * creates SecondarySale records with buyerId = 'SYSTEM' for Raia buyback.
 */
export async function expireStaleListings(): Promise<void> {
  try {
    const now = new Date();

    // Find all ACTIVE listings that have expired
    const staleListings = await prisma.secondaryListing.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          lt: now,
        },
      },
    });

    if (staleListings.length === 0) {
      return;
    }

    // Process each expired listing
    for (const listing of staleListings) {
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Update listing status to TAKEOVER
          await tx.secondaryListing.update({
            where: { id: listing.id },
            data: {
              status: 'TAKEOVER',
              takeoverByRaia: true,
            },
          });

          // 2. Create SecondarySale record with SYSTEM as buyer (Raia takeover)
          await tx.secondarySale.create({
            data: {
              listingId: listing.id,
              buyerId: 'SYSTEM',
              adminFee: 0, // Raia takeover: no fee
              finalPrice: listing.listingPrice, // 100% par
            },
          });

          // 3. Create Transaction TAKEOVER for Raia buyback at 100% par
          await tx.transaction.create({
            data: {
              orderId: `TAKEOVER-${listing.id}-${Date.now()}`,
              userId: listing.sellerId,
              packageId: listing.packageId,
              type: 'TAKEOVER',
              status: 'PAID',
              amount: listing.listingPrice, // 100% par, no fee
              adminFee: 0,
            },
          });

          // 4. Credit seller InvestorBalance (100% payout for takeover)
          await tx.investorBalance.upsert({
            where: { userId: listing.sellerId },
            create: {
              userId: listing.sellerId,
              availableBalance: listing.listingPrice,
              withdrawnBalance: 0,
              totalEarned: listing.listingPrice,
            },
            update: {
              availableBalance: {
                increment: listing.listingPrice,
              },
              totalEarned: {
                increment: listing.listingPrice,
              },
            },
          });
        });
      } catch (listError) {
        // Keep processing the rest if one listing fails (e.g. duplicate sale)
        console.error(`Gagal memproses takeover listing ${listing.id}:`, listError);
      }
    }

    console.log(`Expired ${staleListings.length} stale secondary listings`);
  } catch (error) {
    console.error('Error expiring stale listings:', error);
    // Don't throw - this is a background cleanup operation
  }
}

/**
 * Sapu pembelian secondary yang terkunci tapi pembayarannya tak kunjung tiba.
 *
 * Listing sudah PENDING_PAYMENT (dikunci Task 3) dan transaksinya masih
 * PENDING; begitu `expiredAt` lewat, `releaseSecondaryPending` mengembalikan
 * listing ke ACTIVE dan menandai transaksi EXPIRED tanpa menyentuh aset.
 *
 * Mengikuti pola `expireStaleTransactions()`: dipanggil oportunistik dari
 * route yang membaca data. Satu baris yang gagal tidak menghentikan sisanya,
 * dan kegagalan kueri tidak pernah melempar ke pemanggil.
 */
export async function expireStalePendingPayments(): Promise<void> {
  try {
    const staleTransactions = await prisma.transaction.findMany({
      where: {
        type: 'SECONDARY_BUY',
        status: 'PENDING',
        expiredAt: { lt: new Date() },
      },
      select: { id: true },
    });

    for (const { id } of staleTransactions) {
      try {
        await prisma.$transaction((tx) =>
          releaseSecondaryPending(tx, id, 'EXPIRED')
        );
      } catch (error) {
        console.error(`Gagal melepas pembelian secondary kedaluwarsa ${id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error expiring stale secondary payments:', error);
  }
}
