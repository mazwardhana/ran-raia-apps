import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    const [lotOwnerships, fullOwnerships] = await Promise.all([
      prisma.lotOwnership.findMany({
        where: { userId },
        select: {
          id: true,
          packageId: true,
          lotStart: true,
          lotEnd: true,
          acquiredPrice: true,
        },
      }),
      prisma.fullOwnership.findMany({
        where: { userId },
        select: {
          id: true,
          packageId: true,
          acquiredPrice: true,
        },
      }),
    ]);

    const packageIds = [
      ...lotOwnerships.map((o) => o.packageId),
      ...fullOwnerships.map((o) => o.packageId),
    ];

    if (packageIds.length === 0) {
      return NextResponse.json({
        items: [],
        totalInvested: 0,
        totalProfit: 0,
      });
    }

    const [packages, profitDistributions] = await Promise.all([
      prisma.package.findMany({
        where: { id: { in: packageIds } },
        select: {
          id: true,
          title: true,
          animalType: true,
          price: true,
          totalLots: true,
        },
      }),
      prisma.profitDistribution.findMany({
        where: { packageId: { in: packageIds } },
        select: {
          packageId: true,
          investorShare: true,
        },
      }),
    ]);

    const packageMap = new Map(packages.map((p) => [p.id, p]));
    const profitMap = new Map<string, number>();

    profitDistributions.forEach((dist) => {
      const current = profitMap.get(dist.packageId) || 0;
      profitMap.set(dist.packageId, current + dist.investorShare);
    });

    const items = [];
    let totalInvested = 0;
    let totalProfit = 0;

    for (const lot of lotOwnerships) {
      const pkg = packageMap.get(lot.packageId);
      if (!pkg) continue;

      const lotCount = lot.lotEnd - lot.lotStart + 1;
      const acquiredPrice = lot.acquiredPrice * lotCount;
      const packageProfit = profitMap.get(lot.packageId) || 0;
      const lotFraction = lotCount / pkg.totalLots;
      const profitEarned = Math.floor(packageProfit * lotFraction);

      items.push({
        id: lot.id,
        type: 'LOT',
        packageId: lot.packageId,
        packageTitle: pkg.title,
        lotCount,
        acquiredPrice,
        currentValue: acquiredPrice,
        profitEarned,
      });

      totalInvested += acquiredPrice;
      totalProfit += profitEarned;
    }

    for (const full of fullOwnerships) {
      const pkg = packageMap.get(full.packageId);
      if (!pkg) continue;

      const acquiredPrice = full.acquiredPrice;
      const profitEarned = profitMap.get(full.packageId) || 0;

      items.push({
        id: full.id,
        type: 'FULL',
        packageId: full.packageId,
        packageTitle: pkg.title,
        acquiredPrice,
        currentValue: acquiredPrice,
        profitEarned,
      });

      totalInvested += acquiredPrice;
      totalProfit += profitEarned;
    }

    return NextResponse.json({
      items,
      totalInvested,
      totalProfit,
    });
  } catch (error) {
    console.error('Portfolio fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}
