import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { expireStaleListings } from '@/lib/secondary';

/**
 * DELETE /api/secondary/[id]
 * Penjual membatalkan listing ACTIVE miliknya sendiri.
 *
 * Sapuan kedaluwarsa dijalankan lebih dulu (seperti `POST /api/secondary/buy`):
 * listing yang sudah lewat `expiresAt` tetapi belum tersapu menjadi TAKEOVER,
 * sehingga guard `status: 'ACTIVE'` di bawah gagal dan pembatalan ditolak 409.
 * Tanpa sapuan ini, DELETE yang dibuat langsung bisa membajak takeover Raia.
 *
 * Transisi ber-guard: `updateMany` hanya cocok bila baris itu benar-benar milik
 * pemanggil (`sellerId`) dan masih `ACTIVE`. `count === 0` berarti bukan
 * pemiliknya atau statusnya sudah berubah (mis. PENDING_PAYMENT) → 409.
 * Pembatalan tidak pernah menyentuh `lotOwnership`/`fullOwnership`: aset tetap
 * milik penjual, hanya tawarannya yang ditarik.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Sweep first: expired-but-unswept listings become TAKEOVER, so they can
    // no longer be cancelled by their seller.
    await expireStaleListings();

    const result = await prisma.secondaryListing.updateMany({
      where: { id, sellerId: user.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Listing tidak bisa dibatalkan' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling secondary listing:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
