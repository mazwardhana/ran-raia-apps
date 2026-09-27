import { Box, Stack, Title } from '@mantine/core';
import { Prisma, ListingStatus } from '@prisma/client';
import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth';
import { formatRupiah } from '@/lib/calculations';
import { prisma } from '@/lib/prisma';

import { SecondaryMonitorTable } from './SecondaryMonitorTable';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: string;
}

export default async function OperatorSecondaryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch {
    redirect('/');
  }

  const statusFilter = searchParams.status;

  const where: Prisma.SecondaryListingWhereInput = {};
  if (statusFilter && ['ACTIVE', 'SOLD', 'EXPIRED', 'TAKEOVER', 'CANCELLED'].includes(statusFilter)) {
    where.status = statusFilter as ListingStatus;
  }

  const listings = await prisma.secondaryListing.findMany({
    where,
    orderBy: { listedAt: 'desc' },
    take: 200,
  });

  // Manually join package and user data
  const packageIds = Array.from(new Set(listings.map((l) => l.packageId)));
  const userIds = Array.from(new Set(listings.map((l) => l.sellerId)));

  const [packages, users, sales] = await Promise.all([
    prisma.package.findMany({
      where: { id: { in: packageIds } },
      select: { id: true, code: true, title: true },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, name: true },
    }),
    prisma.secondarySale.findMany({
      where: { listingId: { in: listings.map((l) => l.id) } },
      select: { listingId: true, buyerId: true },
    }),
  ]);

  const packageMap = new Map(packages.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  const saleMap = new Map(sales.map((s) => [s.listingId, s]));

  // Fetch buyer usernames for sales
  const buyerIds = Array.from(new Set(sales.map((s) => s.buyerId).filter((id) => id !== 'SYSTEM')));
  const buyers = await prisma.user.findMany({
    where: { id: { in: buyerIds } },
    select: { id: true, username: true, name: true },
  });
  const buyerMap = new Map(buyers.map((b) => [b.id, b]));

  const rows = listings.map((listing) => {
    const pkg = packageMap.get(listing.packageId);
    const seller = userMap.get(listing.sellerId);
    const sale = saleMap.get(listing.id);
    const buyer = sale
      ? sale.buyerId === 'SYSTEM'
        ? { name: 'Raia (Takeover)' }
        : buyerMap.get(sale.buyerId)
      : null;

    return {
      id: listing.id,
      status: listing.status,
      statusLabel:
        listing.status === 'ACTIVE'
          ? 'Aktif'
          : listing.status === 'SOLD'
          ? 'Terjual'
          : listing.status === 'TAKEOVER'
          ? 'Takeover'
          : listing.status === 'EXPIRED'
          ? 'Kedaluwarsa'
          : listing.status === 'CANCELLED'
          ? 'Dibatalkan'
          : listing.status,
      packageCode: pkg?.code || '-',
      packageTitle: pkg?.title || '-',
      sellerName: seller?.name || seller?.username || '-',
      buyerName:
        listing.status === 'SOLD' || listing.status === 'TAKEOVER'
          ? buyer?.name || '-'
          : '-',
      listingPrice: formatRupiah(listing.listingPrice),
      listedAt: new Date(listing.listedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      expiresAt: new Date(listing.expiresAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      takeoverLabel: listing.takeoverByRaia ? 'Ya' : 'Tidak',
    };
  });

  return (
    <Box p="md">
      <Stack gap="md">
        <Title order={1}>Monitoring Secondary Market</Title>
        <SecondaryMonitorTable rows={rows} currentStatus={statusFilter || ''} />
      </Stack>
    </Box>
  );
}
