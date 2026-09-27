import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Server validation: id wajib ada dan wajar
  if (!id || typeof id !== 'string' || id.length > 64 || id.length < 1) {
    return NextResponse.json({ error: 'ID paket tidak valid' }, { status: 400 });
  }

  try {
    const pkg = await prisma.package.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        title: true,
        animalType: true,
        price: true,
        lotPrice: true,
        totalLots: true,
        soldLots: true,
        status: true,
        coverImage: true,
        description: true,
        estimatedRoi: true,
        estimatedOffspring: true,
        estimatedOffspringPrice: true,
        estimatedMilkMonthly: true,
        estimatedMilkPrice: true,
        periodMonths: true,
        startDate: true,
        endDate: true,
        maxInvestors: true,
        siteProject: {
          select: {
            id: true,
            name: true,
            legalEntity: true,
            address: true,
            province: true,
            city: true,
          },
        },
        costs: {
          select: {
            id: true,
            costType: true,
            amount: true,
            description: true,
          },
          orderBy: { amount: 'desc' as const },
        },
      },
    });

    // Paket DRAFT tidak ditawarkan ke investor
    if (!pkg || pkg.status === 'DRAFT') {
      return NextResponse.json(
        { error: 'Paket tidak ditemukan' },
        { status: 404 }
      );
    }

    const progress =
      pkg.totalLots > 0
        ? Math.min(100, Math.round((pkg.soldLots / pkg.totalLots) * 100))
        : 0;

    return NextResponse.json({
      ...pkg,
      progress: { soldLots: pkg.soldLots, totalLots: pkg.totalLots, percent: progress },
    });
  } catch (error) {
    console.error('Error fetching package detail:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
