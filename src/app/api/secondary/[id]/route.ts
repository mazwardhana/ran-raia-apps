import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * DELETE /api/secondary/[id]
 * Penjual membatalkan listing ACTIVE miliknya sendiri.
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
