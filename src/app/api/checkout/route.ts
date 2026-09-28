import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkoutSchema } from '@/lib/validation';
import { calcLotOrder } from '@/lib/calculations';
import { createSnapToken, isSimulateMode } from '@/lib/midtrans';
import {
  calcLotRange,
  expireStaleTransactions,
  releaseReservation,
} from '@/lib/reservations';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.kycStatus !== 'VERIFIED') {
      return NextResponse.json(
        { error: 'KYC belum terverifikasi. Silakan selesaikan KYC terlebih dahulu.' },
        { status: 403 }
      );
    }

    // Lepaskan slot dari pesanan yang sudah kedaluwarsa sebelum menghitung
    // ketersediaan (pola yang sama dengan expireStaleListings).
    await expireStaleTransactions();

    const body = await request.json();
    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Data tidak valid', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { packageId, ownershipType, lotCount } = validation.data;

    const minCheckoutSetting = await prisma.setting.findUnique({
      where: { id: 'min_checkout' },
    });
    const minCheckout = minCheckoutSetting
      ? parseInt(minCheckoutSetting.value, 10)
      : 50000;

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        code: true,
        title: true,
        price: true,
        lotPrice: true,
        totalLots: true,
        soldLots: true,
        status: true,
      },
    });

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paket tidak ditemukan' },
        { status: 404 }
      );
    }

    if (pkg.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Paket tidak tersedia untuk pembelian' },
        { status: 400 }
      );
    }

    let totalAmount = 0;
    let requestedLots = 0;

    if (ownershipType === 'FULL') {
      if (pkg.soldLots > 0) {
        return NextResponse.json(
          { error: 'Paket sudah tidak tersedia untuk pembelian penuh' },
          { status: 409 }
        );
      }
      totalAmount = pkg.price;
      requestedLots = pkg.totalLots;
    } else {
      if (!lotCount || lotCount <= 0) {
        return NextResponse.json(
          { error: 'Jumlah lot harus lebih dari 0' },
          { status: 400 }
        );
      }

      const orderResult = calcLotOrder(lotCount, pkg.lotPrice, minCheckout);
      if (!orderResult.ok) {
        return NextResponse.json(
          { error: orderResult.error },
          { status: 400 }
        );
      }

      const availableLots = pkg.totalLots - pkg.soldLots;
      if (lotCount > availableLots) {
        return NextResponse.json(
          { error: `Hanya tersisa ${availableLots} lot` },
          { status: 409 }
        );
      }

      totalAmount = orderResult.subtotal;
      requestedLots = lotCount;
    }

    const orderId = `TRX-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const midtransOrderId = `MID-${orderId}`;

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.package.updateMany({
        where: {
          id: packageId,
          soldLots: { lte: pkg.totalLots - requestedLots },
        },
        data: {
          soldLots: { increment: requestedLots },
        },
      });

      if (updateResult.count === 0) {
        throw new Error('OVERSOLD');
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const transaction = await tx.transaction.create({
        data: {
          orderId,
          userId: user.id,
          packageId,
          type: 'BUY',
          status: 'PENDING',
          amount: totalAmount,
          adminFee: 0,
          lotCount: ownershipType === 'LOT' ? requestedLots : null,
          midtransOrderId,
          expiredAt: expiresAt,
        },
      });

      if (ownershipType === 'FULL') {
        await tx.fullOwnership.create({
          data: {
            transactionId: transaction.id,
            userId: user.id,
            packageId,
            acquiredPrice: pkg.price,
          },
        });
      } else {
        const { lotStart, lotEnd } = calcLotRange(pkg.soldLots, requestedLots);

        await tx.lotOwnership.create({
          data: {
            transactionId: transaction.id,
            userId: user.id,
            packageId,
            lotStart,
            lotEnd,
            acquiredPrice: pkg.lotPrice,
          },
        });
      }

      return transaction;
    });

    if (isSimulateMode()) {
      // Mode simulasi: lewati Midtrans, arahkan ke halaman simulasi internal.
      return NextResponse.json({
        orderId: result.orderId,
        snapToken: null,
        redirectUrl: `/app/bayar-simulasi/${result.orderId}`,
        total: totalAmount,
        simulate: true,
      });
    }

    try {
      // Email asli pembeli untuk Midtrans. `getCurrentUser()` hanya membawa
      // id/role/username/kycStatus, jadi dibaca terpisah dengan select sempit.
      const buyer = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true },
      });

      const snapToken = await createSnapToken({
        orderId: midtransOrderId,
        grossAmount: totalAmount,
        itemDetails: [
          {
            id: pkg.code,
            name: pkg.title,
            price: ownershipType === 'FULL' ? pkg.price : pkg.lotPrice,
            quantity: ownershipType === 'FULL' ? 1 : requestedLots,
          },
        ],
        customerDetails: {
          first_name: user.username,
          email: buyer?.email,
        },
      });

      await prisma.transaction.update({
        where: { id: result.id },
        data: { snapToken: snapToken.token },
      });

      return NextResponse.json({
        orderId: result.orderId,
        snapToken: snapToken.token,
        redirectUrl: snapToken.redirect_url,
        total: totalAmount,
        simulate: false,
      });
    } catch (snapError) {
      // Slot sudah terlanjur kebagian pada pesanan ini; lepaskan lagi supaya
      // tidak bocor saat token gagal dibuat.
      console.error('Gagal membuat sesi pembayaran Midtrans:', snapError);
      await prisma.$transaction((tx) =>
        releaseReservation(tx, result.id, 'CANCELLED')
      );

      return NextResponse.json(
        { error: 'Gagal membuat sesi pembayaran. Slot Anda telah dikembalikan, silakan coba lagi.' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Checkout error:', error);

    if (error instanceof Error && error.message === 'OVERSOLD') {
      return NextResponse.json(
        { error: 'Slot tidak tersedia, pembelian gagal' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses checkout' },
      { status: 500 }
    );
  }
}
