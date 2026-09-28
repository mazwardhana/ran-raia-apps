import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { expireStaleListings } from '@/lib/secondary';

interface MyAsset {
  ownershipId: string;
  ownershipType: 'FULL' | 'LOT';
  packageId: string;
  packageTitle: string;
  packageCode: string;
  parPrice: number;
  lotStart: number | null;
  lotEnd: number | null;
  acquiredAt: string;
  listed: boolean;
}

/**
 * GET /api/secondary
 * Returns ACTIVE listings with package and seller info.
 * Also returns current user's ownerships for "Aset Saya" section.
 * Runs expireStaleListings() before returning (cron-style).
 */
export async function GET() {
  try {
    // Run expiry check before returning listings
    await expireStaleListings();

    const user = await getCurrentUser();

    // Fetch ACTIVE listings
    const listings = await prisma.secondaryListing.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        listedAt: 'desc',
      },
    });

    // Manually join package data (no relation in schema)
    const packageIds = Array.from(new Set(listings.map((l) => l.packageId)));
    const packages = await prisma.package.findMany({
      where: {
        id: { in: packageIds },
      },
      select: {
        id: true,
        code: true,
        title: true,
        animalType: true,
        price: true,
        siteProject: {
          select: {
            name: true,
          },
        },
      },
    });

    const packageMap = new Map(packages.map((p) => [p.id, p]));

    const enrichedListings = listings.map((listing) => ({
      ...listing,
      isMine: user ? listing.sellerId === user.id : false,
      package: packageMap.get(listing.packageId) || null,
    }));

    // Listing duration setting (days) for countdown/sell copy
    const daysSetting = await prisma.setting.findUnique({
      where: { id: 'secondary_market_days' },
      select: { value: true },
    });
    const parsedDays = daysSetting ? parseInt(daysSetting.value, 10) : 7;
    const listingDays = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : 7;

    // Fetch user's ownerships for "Aset Saya" (if authenticated)
    let myAssets: MyAsset[] = [];
    if (user) {
      const [lotOwnerships, fullOwnerships, activeListings] = await Promise.all([
        prisma.lotOwnership.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            packageId: true,
            lotStart: true,
            lotEnd: true,
            createdAt: true,
          },
        }),
        prisma.fullOwnership.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            packageId: true,
            createdAt: true,
          },
        }),
        prisma.secondaryListing.findMany({
          where: {
            sellerId: user.id,
            status: 'ACTIVE',
          },
          select: {
            packageId: true,
            ownershipType: true,
            lotStart: true,
            lotEnd: true,
          },
        }),
      ]);

      const ownershipPackageIds = [
        ...lotOwnerships.map((o) => o.packageId),
        ...fullOwnerships.map((o) => o.packageId),
      ];

      const ownershipPackages = await prisma.package.findMany({
        where: { id: { in: ownershipPackageIds } },
        select: {
          id: true,
          code: true,
          title: true,
          price: true,
        },
      });

      const pkgMap = new Map(ownershipPackages.map((p) => [p.id, p]));
      // LOT holdings accumulate, so the badge must identify the exact holding
      // (package + lot range); otherwise listing one row lights up every row
      // for that package. FULL stays package-wide — there is only one.
      const listedKey = (
        packageId: string,
        ownershipType: 'FULL' | 'LOT',
        lotStart: number | null,
        lotEnd: number | null
      ) =>
        ownershipType === 'LOT'
          ? `${packageId}-LOT-${lotStart}-${lotEnd}`
          : `${packageId}-FULL`;
      const listedSet = new Set(
        activeListings.map((l) =>
          listedKey(l.packageId, l.ownershipType, l.lotStart, l.lotEnd)
        )
      );

      myAssets = [
        ...lotOwnerships.map((o): MyAsset => {
          const pkg = pkgMap.get(o.packageId);
          return {
            ownershipId: o.id,
            ownershipType: 'LOT',
            packageId: o.packageId,
            packageTitle: pkg?.title || '-',
            packageCode: pkg?.code || '-',
            parPrice: pkg?.price || 0,
            lotStart: o.lotStart,
            lotEnd: o.lotEnd,
            acquiredAt: o.createdAt.toISOString(),
            listed: listedSet.has(listedKey(o.packageId, 'LOT', o.lotStart, o.lotEnd)),
          };
        }),
        ...fullOwnerships.map((o): MyAsset => {
          const pkg = pkgMap.get(o.packageId);
          return {
            ownershipId: o.id,
            ownershipType: 'FULL',
            packageId: o.packageId,
            packageTitle: pkg?.title || '-',
            packageCode: pkg?.code || '-',
            parPrice: pkg?.price || 0,
            lotStart: null,
            lotEnd: null,
            acquiredAt: o.createdAt.toISOString(),
            listed: listedSet.has(listedKey(o.packageId, 'FULL', null, null)),
          };
        }),
      ];
    }

    return NextResponse.json({ listings: enrichedListings, myAssets, listingDays });
  } catch (error) {
    console.error('Error fetching secondary listings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
