import { prisma } from '@/lib/prisma';

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
