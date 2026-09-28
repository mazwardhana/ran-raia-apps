import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySignature } from '@/lib/midtrans';
import { releaseReservation } from '@/lib/reservations';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = body;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const isValid = verifySignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    );

    if (!isValid) {
      console.error('Invalid signature for order:', order_id);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const transaction = await prisma.transaction.findFirst({
      where: { midtransOrderId: order_id },
      include: {
        lotOwnership: true,
        fullOwnership: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.status === 'EXPIRED') {
      return NextResponse.json(
        { error: 'Transaction expired' },
        { status: 400 }
      );
    }

    const validStatuses = ['settlement', 'capture'];
    const shouldUpdateToPaid =
      validStatuses.includes(transaction_status) &&
      (fraud_status === 'accept' || !fraud_status);

    if (shouldUpdateToPaid && transaction.status === 'PENDING') {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentChannel: body.payment_type || null,
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
        message: 'Payment processed',
      });
    }

    if (transaction_status === 'deny' || transaction_status === 'cancel') {
      // Lepas slot lot dan baris kepemilikan, bukan hanya statusnya.
      await prisma.$transaction((tx) =>
        releaseReservation(tx, transaction.id, 'CANCELLED')
      );

      return NextResponse.json({
        status: 'cancelled',
        message: 'Payment cancelled',
      });
    }

    if (transaction_status === 'expire') {
      await prisma.$transaction((tx) =>
        releaseReservation(tx, transaction.id, 'EXPIRED')
      );

      return NextResponse.json({
        status: 'expired',
        message: 'Payment expired',
      });
    }

    return NextResponse.json({
      status: 'pending',
      message: 'Payment status pending',
    });
  } catch (error) {
    console.error('Midtrans callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
