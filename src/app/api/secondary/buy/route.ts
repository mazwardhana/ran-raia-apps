import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { expireStaleListings, calculateFee } from '@/lib/secondary';
import { createSnapToken, isSimulateMode } from '@/lib/midtrans';

/**
 * POST /api/secondary/buy
 * Buy a secondary listing.
 * Locks the listing at PENDING_PAYMENT and creates a Midtrans snap session.
 * Ownership transfer happens only on payment settlement (see Task 4).
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

    // Check if buyer already owns this package as FULL (prevent duplicate FULL ownership).
    // LOT holdings may accumulate, so an existing lot row does not block a purchase.
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
    }

    // Execute transaction: lock listing + create payment record
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomic check-and-set: lock listing to PENDING_PAYMENT
      const updated = await tx.secondaryListing.updateMany({
        where: { id: listing.id, status: 'ACTIVE' },
        data: { status: 'PENDING_PAYMENT' },
      });

      if (updated.count === 0) {
        throw new Error('LISTING_TAKEN');
      }

      // 2. Calculate admin fee
      const { adminFee } = await calculateFee(listing.listingPrice, tx);

      // 3. Create transaction record
      const orderId = `SEC-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const transaction = await tx.transaction.create({
        data: {
          orderId,
          userId: user.id,
          packageId: listing.packageId,
          type: 'SECONDARY_BUY',
          status: 'PENDING',
          amount: listing.listingPrice,
          adminFee,
          midtransOrderId: `MID-${orderId}`,
          expiredAt: expiresAt,
          secondaryListingId: listing.id,
        },
      });

      return { orderId, total: listing.listingPrice, transaction };
    });

    // Handle simulate mode
    if (isSimulateMode()) {
      return NextResponse.json({
        orderId: result.orderId,
        snapToken: null,
        redirectUrl: `/app/bayar-simulasi/${result.orderId}`,
        total: result.total,
        simulate: true,
      });
    }

    // Create Midtrans snap token
    try {
      // Email asli pembeli untuk Midtrans
      const buyer = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true },
      });

      const midtransOrderId = `MID-${result.orderId}`;
      const snapToken = await createSnapToken({
        orderId: midtransOrderId,
        grossAmount: result.total,
        itemDetails: [
          {
            id: listing.packageId,
            name: `Listing ${listing.id}`,
            price: result.total,
            quantity: 1,
          },
        ],
        customerDetails: {
          first_name: user.username,
          email: buyer?.email,
        },
      });

      await prisma.transaction.update({
        where: { id: result.transaction.id },
        data: { snapToken: snapToken.token },
      });

      return NextResponse.json({
        orderId: result.orderId,
        snapToken: snapToken.token,
        redirectUrl: snapToken.redirect_url,
        total: result.total,
        simulate: false,
      });
    } catch (snapError) {
      console.error('Gagal membuat sesi pembayaran Midtrans:', snapError);

      // Ruling 4: batalkan transaksi PENDING dan lepas tautan `secondaryListingId`
      // (kolom @unique) supaya percobaan ulang tidak menabrak P2002, lalu
      // kembalikan listing ke ACTIVE.
      await prisma.$transaction(async (tx) => {
        // Transisi status ber-guard: hanya PENDING yang boleh dibatalkan,
        // mengikuti pola `releaseReservation` di `src/lib/reservations.ts`.
        await tx.transaction.updateMany({
          where: { id: result.transaction.id, status: 'PENDING' },
          data: { status: 'CANCELLED', secondaryListingId: null },
        });
        await tx.secondaryListing.updateMany({
          where: { id: listing.id, status: 'PENDING_PAYMENT' },
          data: { status: 'ACTIVE' },
        });
      });

      return NextResponse.json(
        { error: 'Gagal membuat sesi pembayaran. Listing Anda masih aktif dan bisa dicoba lagi.' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Error buying secondary listing:', error);

    if (error instanceof Error && error.message === 'LISTING_TAKEN') {
      return NextResponse.json(
        { error: 'Listing sudah tidak aktif' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}