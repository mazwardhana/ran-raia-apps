import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { kycStatus: true },
  });

  return NextResponse.json({ kycStatus: dbUser?.kycStatus || 'PENDING' });
}

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  await prisma.user.update({
    where: { id: user.id },
    data: { kycStatus: 'VERIFIED' },
  });

  return NextResponse.json({ verified: true });
}
