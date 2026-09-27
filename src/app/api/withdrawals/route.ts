import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withdrawalSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = withdrawalSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      );
    }

    const { amount, bankName, bankAccount, bankHolder } = validation.data;

    const balance = await prisma.investorBalance.findUnique({
      where: { userId: user.id },
      select: { availableBalance: true },
    });

    if (!balance || balance.availableBalance < amount) {
      return NextResponse.json(
        { error: 'Saldo tidak mencukupi' },
        { status: 400 }
      );
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: user.id,
        amount,
        bankName,
        bankAccount,
        bankHolder,
        status: 'PENDING',
      },
      select: { id: true },
    });

    return NextResponse.json({ id: withdrawal.id }, { status: 201 });
  } catch (error) {
    console.error('Withdrawal creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create withdrawal' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        bankName: true,
        bankAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error('Withdrawal fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}
