import { DashboardView } from '@/components/investor/DashboardView';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    // User not authenticated; middleware should redirect, but handle gracefully
  }

  const userId = user?.id;

  const [
    investmentAgg,
    balance,
    lotOwnerships,
    fullOwnerships,
    recentEvents,
  ] = await Promise.all([
    userId
      ? prisma.transaction.aggregate({
          where: { userId, status: 'PAID', type: 'BUY' },
          _sum: { amount: true },
        })
      : { _sum: { amount: null } },
    userId ? prisma.investorBalance.findUnique({ where: { userId } }) : null,
    userId
      ? prisma.lotOwnership.findMany({
          where: { userId },
          select: { lotStart: true, lotEnd: true, acquiredPrice: true, packageId: true },
        })
      : [],
    userId
      ? prisma.fullOwnership.findMany({
          where: { userId },
          select: { acquiredPrice: true, packageId: true },
        })
      : [],
    prisma.livestockEvent.findMany({
      take: 5,
      orderBy: { eventDate: 'desc' },
      select: {
        id: true,
        eventType: true,
        eventDate: true,
        description: true,
        livestock: { select: { tagNumber: true, name: true } },
      },
    }),
  ]);

  // Fetch packages for owned packageIds
  const ownedPackageIds = [
    ...Array.from(
      new Set([
        ...lotOwnerships.map((o) => o.packageId),
        ...fullOwnerships.map((o) => o.packageId),
      ])
    ),
  ];

  const packages =
    ownedPackageIds.length > 0
      ? await prisma.package.findMany({
          where: { id: { in: ownedPackageIds } },
          select: { id: true, animalType: true, price: true, totalLots: true },
        })
      : [];

  const packageMap = new Map(packages.map((p) => [p.id, p]));

  const totalInvestment = investmentAgg._sum.amount || 0;
  const totalProfit = balance?.totalEarned || 0;

  // Total lots: sum (lotEnd - lotStart + 1) for all lot ownerships
  const totalLots = lotOwnerships.reduce(
    (sum, lot) => sum + (lot.lotEnd - lot.lotStart + 1),
    0
  );

  // Portfolio distribution: group by animalType
  const distributionMap: Record<'KAMBING' | 'SAPI', number> = {
    KAMBING: 0,
    SAPI: 0,
  };

  lotOwnerships.forEach((lot) => {
    const pkg = packageMap.get(lot.packageId);
    if (!pkg) return;
    const lotCount = lot.lotEnd - lot.lotStart + 1;
    const value = lot.acquiredPrice * lotCount;
    const type = pkg.animalType as 'KAMBING' | 'SAPI';
    distributionMap[type] += value;
  });

  fullOwnerships.forEach((full) => {
    const pkg = packageMap.get(full.packageId);
    if (!pkg) return;
    const type = pkg.animalType as 'KAMBING' | 'SAPI';
    distributionMap[type] += full.acquiredPrice;
  });

  const portfolioDistribution = Object.entries(distributionMap)
    .filter(([, value]) => value > 0)
    .map(([animalType, value]) => ({
      animalType: animalType as 'KAMBING' | 'SAPI',
      value,
    }));

  // Profit trend: fetch profit distributions for owned packages (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const profitDists =
    ownedPackageIds.length > 0
      ? await prisma.profitDistribution.findMany({
          where: {
            packageId: { in: ownedPackageIds },
            createdAt: { gte: sixMonthsAgo },
          },
          select: { period: true, investorShare: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];

  // Group by period (month)
  const profitByPeriod = new Map<string, { profit: number; createdAt: Date }>();
  profitDists.forEach((dist) => {
    const existing = profitByPeriod.get(dist.period);
    if (existing) {
      existing.profit += dist.investorShare;
    } else {
      profitByPeriod.set(dist.period, {
        profit: dist.investorShare,
        createdAt: dist.createdAt,
      });
    }
  });

  const profitTrend = Array.from(profitByPeriod.entries()).map(
    ([period, data]) => ({
      period,
      profit: data.profit,
      createdAt: data.createdAt,
    })
  );

  const recentEventsData = recentEvents.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    eventDate: event.eventDate,
    description: event.description || '',
    livestockTag: event.livestock.tagNumber,
  }));

  return (
    <DashboardView
      data={{
        totalInvestment,
        totalProfit,
        totalLots,
        portfolioDistribution,
        profitTrend,
        recentEvents: recentEventsData,
        kycStatus: user?.kycStatus,
      }}
    />
  );
}
