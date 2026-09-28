import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { isSimulateMode } from '@/lib/midtrans';
import { prisma } from '@/lib/prisma';
import { releaseReservation } from '@/lib/reservations';

/**
 * POST /api/payments/simulate
 *
 * Menandai pesanan lunas / batal tanpa Midtrans, untuk demo offline.
 * Endpoint ini **hanya** hidup ketika `MIDTRANS_MODE=simulate`; pada mode
 * nyata ia membalas 404 supaya tidak pernah menjadi celah "tandai lunas
 * sendiri". Hanya pesanan milik pengguna yang login yang boleh disentuh.
 *
 * Body: { orderId: string, action: 'success' | 'cancel' }
 */
export async function POST(request: NextRequest) {
  if (!isSimulateMode()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, action } = body ?? {};

    if (typeof orderId !== 'string' || !orderId) {
      return NextResponse.json(
        { error: 'Order ID tidak valid' },
        { status: 400 }
      );
    }

    if (action !== 'success' && action !== 'cancel') {
      return NextResponse.json(
        { error: 'Aksi simulasi tidak dikenal' },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { orderId },
    });

    // Jangan bocorkan keberadaan pesanan milik pengguna lain.
    if (!transaction || transaction.userId !== user.id) {
      return NextResponse.json(
        { error: 'Pesanan tidak ditemukan' },
        { status: 404 }
      );
    }

    if (transaction.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Pesanan sudah tidak menunggu pembayaran' },
        { status: 409 }
      );
    }

    if (action === 'cancel') {
      await prisma.$transaction((tx) =>
        releaseReservation(tx, transaction.id, 'CANCELLED')
      );

      return NextResponse.json({
        status: 'cancelled',
        message: 'Pesanan dibatalkan',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentChannel: 'SIMULATE',
        },
      });

      await tx.investorBalance.upsert({
        where: { userId: transaction.userId },
        create: {
          userId: transaction.userId,
          availableBalance: 0,
          withdrawnBalance: 0,
          totalEarned: 0,
        },
        update: {},
      });
    });

    return NextResponse.json({
      status: 'success',
      message: 'Pembayaran simulasi berhasil',
    });
  } catch (error) {
    console.error('Simulate payment error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
