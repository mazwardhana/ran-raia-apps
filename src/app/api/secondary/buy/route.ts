import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { expireStaleListings } from '@/lib/secondary';

/**
 * POST /api/secondary/buy
 * Buy a secondary listing.
 * Body: { listingId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { listingId } = body;

    if (!listingId || typeof listingId !== 'string') {
      return NextResponse.json(
        { error: 'ID listing tidak valid' },
        { status: 400 }
      );
    }

    // Run expiry check first (stale listings become TAKEOVER)
    await expireStaleListings();

    // Fetch listing
    const listing = await prisma.secondaryListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      return NextResponse.json(
        { error: 'Listing tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validate ACTIVE
    if (listing.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Listing sudah tidak aktif' },
        { status: 400 }
      );
    }

    // Defensive: reject expired listing even if takeover sweep failed
    if (new Date(listing.expiresAt).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'Listing sudah kedaluwarsa' },
        { status: 400 }
      );
    }

    // Validate buyer != seller
    if (listing.sellerId === user.id) {
      return NextResponse.json(
        { error: 'Tidak dapat membeli aset sendiri' },
        { status: 400 }
      );
    }

    // Check if buyer already owns this package (prevent duplicate ownership)
    if (listing.ownershipType === 'FULL') {
      const existingOwnership = await prisma.fullOwnership.findFirst({
        where: {
          packageId: listing.packageId,
          userId: user.id,
        },
      });
      if (existingOwnership) {
        return NextResponse.json(
          { error: 'Anda sudah memiliki aset pada paket ini' },
          { status: 400 }
        );
      }
    } else {
      const existingOwnership = await prisma.lotOwnership.findFirst({
        where: {
          packageId: listing.packageId,
          userId: user.id,
        },
      });
      if (existingOwnership) {
        return NextResponse.json(
          { error: 'Anda sudah memiliki aset pada paket ini' },
          { status: 400 }
        );
      }
    }

    // Get admin fee from settings
    const [feePercentSetting, feeFlatSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { id: 'secondary_admin_fee_percent' } }),
      prisma.setting.findUnique({ where: { id: 'secondary_admin_fee_flat' } }),
    ]);

    const feePercentRaw = feePercentSetting ? parseFloat(feePercentSetting.value) : 0;
    const feeFlatRaw = feeFlatSetting ? parseInt(feeFlatSetting.value, 10) : 0;
    const feePercent = Number.isFinite(feePercentRaw) && feePercentRaw > 0 ? feePercentRaw : 0;
    const feeFlat = Number.isInteger(feeFlatRaw) && feeFlatRaw > 0 ? feeFlatRaw : 0;

    const adminFee = feeFlat + Math.floor((listing.listingPrice * feePercent) / 100);
    const sellerPayout = listing.listingPrice - adminFee;

    // Execute transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create SecondarySale
      await tx.secondarySale.create({
        data: {
          listingId: listing.id,
          buyerId: user.id,
          adminFee,
          finalPrice: listing.listingPrice,
        },
      });

      // 2. Transfer ownership
      if (listing.ownershipType === 'FULL') {
        const ownership = await tx.fullOwnership.findFirst({
          where: {
            packageId: listing.packageId,
            userId: listing.sellerId,
          },
        });
        if (ownership) {
          await tx.fullOwnership.update({
            where: { id: ownership.id },
            data: { userId: user.id },
          });
        }
      } else {
        const ownership = await tx.lotOwnership.findFirst({
          where: {
            packageId: listing.packageId,
            userId: listing.sellerId,
          },
        });
        if (ownership) {
          await tx.lotOwnership.update({
            where: { id: ownership.id },
            data: { userId: user.id },
          });
        }
      }

      // 3. Mark listing SOLD
      await tx.secondaryListing.update({
        where: { id: listing.id },
        data: {
          status: 'SOLD',
          soldAt: new Date(),
        },
      });

      // 4. Credit seller InvestorBalance (payout)
      await tx.investorBalance.upsert({
        where: { userId: listing.sellerId },
        create: {
          userId: listing.sellerId,
          availableBalance: sellerPayout,
          withdrawnBalance: 0,
          totalEarned: sellerPayout,
        },
        update: {
          availableBalance: {
            increment: sellerPayout,
          },
          totalEarned: {
            increment: sellerPayout,
          },
        },
      });

      // 5. Create Transaction SELL record for seller (audit trail)
      await tx.transaction.create({
        data: {
          orderId: `SELL-${listing.id}-${Date.now()}`,
          userId: listing.sellerId,
          packageId: listing.packageId,
          type: 'SELL',
          status: 'PAID',
          amount: listing.listingPrice,
          adminFee,
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error buying secondary listing:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
