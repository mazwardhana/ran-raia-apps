import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { isSimulateMode } from '@/lib/midtrans';
import { prisma } from '@/lib/prisma';
import { releaseReservation } from '@/lib/reservations';
import {
  completeSecondaryPurchase,
  releaseSecondaryPending,
} from '@/lib/secondary-settlement';

/**
 * Dilempar di dalam `$transaction` ketika gerbang atomik tidak menemukan baris
 * PENDING lagi (dibatalkan/sapuan oleh pemanggil lain). Membatalkan seluruh
 * transaksi supaya tidak ada baris yang berubah setengah jadi.
 */
class PesananBerubahError extends Error {
  constructor() {
    super('PESANAN_BUKAN_PENDING_LAGI');
    this.name = 'PesananBerubahError';
  }
}

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
      // Pembelian secondary tidak pernah memindahkan aset saat bayar, jadi
      // cukup kembalikan listing ke ACTIVE. Transaksi primer melepas slotnya.
      const isSecondary = transaction.type === 'SECONDARY_BUY';

      await prisma.$transaction((tx) =>
        isSecondary
          ? releaseSecondaryPending(tx, transaction.id, 'CANCELLED')
          : releaseReservation(tx, transaction.id, 'CANCELLED')
      );

      return NextResponse.json({
        status: 'cancelled',
        message: 'Pesanan dibatalkan',
      });
    }

    // Gerbang atomik: jangan pernah menulis PAID tanpa memastikan baris masih
    // PENDING. `updateMany` ber-predikat status inilah yang memutuskan, bukan
    // pengecekan di atas — di bawah READ COMMITTED keduanya bisa lolos.
    try {
      await prisma.$transaction(async (tx) => {
        // Pembelian secondary diselesaikan lewat jalur settlement yang sama
        // dengan callback Midtrans: pindahkan aset ke pembeli dan kredit
        // penjual. Jalur primer di bawah hanya menandai PAID + baris saldo 0,
        // yang akan meninggalkan listing menggantung di PENDING_PAYMENT.
        if (
          transaction.type === 'SECONDARY_BUY' &&
          transaction.secondaryListingId
        ) {
          await completeSecondaryPurchase(tx, transaction.id, 'SIMULATE');
          return;
        }

        const claimed = await tx.transaction.updateMany({
          where: { id: transaction.id, status: 'PENDING' },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentChannel: 'SIMULATE',
          },
        });

        if (claimed.count !== 1) {
          // Pembalap (mis. cancel) sudah menyetel status dan melepas slotnya.
          // Batalkan transaksi; jangan kredit saldo di atas pesanan yang batal.
          throw new PesananBerubahError();
        }

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
    } catch (error) {
      if (error instanceof PesananBerubahError) {
        return NextResponse.json(
          { error: 'Pesanan sudah tidak menunggu pembayaran' },
          { status: 409 }
        );
      }
      throw error;
    }

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
