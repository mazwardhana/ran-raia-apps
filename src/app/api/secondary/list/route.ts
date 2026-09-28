import { NextRequest, NextResponse } from 'next/server';
import { OwnershipType } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { calcListingExpiry } from '@/lib/calculations';
import { createNotification } from '@/lib/notifications';

/**
 * POST /api/secondary/list
 * Create a new secondary listing at par price.
 * Body: { ownershipType: 'FULL' | 'LOT', ownershipId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ownershipType, ownershipId } = body;

    // Validation
    if (ownershipType !== 'FULL' && ownershipType !== 'LOT') {
      return NextResponse.json(
        { error: 'Tipe kepemilikan tidak valid' },
        { status: 400 }
      );
    }
    const type: OwnershipType = ownershipType;

    if (!ownershipId || typeof ownershipId !== 'string') {
      return NextResponse.json(
        { error: 'ID kepemilikan tidak valid' },
        { status: 400 }
      );
    }

    // Get the ownership record and verify user owns it
    let packageId: string;
    let lotStart: number | null = null;
    let lotEnd: number | null = null;

    if (type === 'FULL') {
      const ownership = await prisma.fullOwnership.findFirst({
        where: {
          id: ownershipId,
          userId: user.id,
        },
      });

      if (!ownership) {
        return NextResponse.json(
          { error: 'Kepemilikan tidak ditemukan atau bukan milik Anda' },
          { status: 404 }
        );
      }

      packageId = ownership.packageId;
    } else {
      // LOT ownership
      const ownership = await prisma.lotOwnership.findFirst({
        where: {
          id: ownershipId,
          userId: user.id,
        },
      });

      if (!ownership) {
        return NextResponse.json(
          { error: 'Kepemilikan tidak ditemukan atau bukan milik Anda' },
          { status: 404 }
        );
      }

      packageId = ownership.packageId;
      lotStart = ownership.lotStart;
      lotEnd = ownership.lotEnd;
    }

    // Par = harga paket (harga sama untuk penjual dan pembeli)
    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
      select: { price: true },
    });

    if (!pkg) {
      return NextResponse.json(
        { error: 'Paket tidak ditemukan' },
        { status: 404 }
      );
    }

    const packagePrice = pkg.price;

    // Check if already listed. LOT holdings accumulate, so a seller may hold
    // several rows for one package and list each separately — the uniqueness
    // check must be scoped to the exact holding (lotStart/lotEnd), not the
    // package. FULL stays package-wide: only one 100% holding can exist.
    const existingListing = await prisma.secondaryListing.findFirst({
      where: {
        sellerId: user.id,
        packageId,
        ownershipType: type,
        status: 'ACTIVE',
        ...(type === 'LOT' ? { lotStart, lotEnd } : {}),
      },
    });

    if (existingListing) {
      return NextResponse.json(
        { error: 'Aset sudah terdaftar di secondary market' },
        { status: 400 }
      );
    }

    // Get secondary market days from settings (default 7)
    const settingDays = await prisma.setting.findUnique({
      where: { id: 'secondary_market_days' },
    });
    const parsedDays = settingDays ? parseInt(settingDays.value, 10) : 7;
    const days = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : 7;

    // Create listing at par price
    const listedAt = new Date();
    const expiresAt = calcListingExpiry(listedAt, days);

    const listing = await prisma.secondaryListing.create({
      data: {
        sellerId: user.id,
        packageId,
        ownershipType: type,
        lotStart,
        lotEnd,
        listingPrice: packagePrice, // Par price
        status: 'ACTIVE',
        listedAt,
        expiresAt,
      },
    });

    await createNotification({
      userId: user.id,
      type: 'LISTING',
      title: 'Aset berhasil ditawarkan',
      body: `Listing ${
        type === 'FULL' ? 'paket utuh' : `lot ${lotStart}-${lotEnd}`
      } aktif di secondary market hingga ${expiresAt.toLocaleDateString('id-ID')}.`,
      data: { listingId: listing.id, packageId },
    });

    return NextResponse.json({ listing }, { status: 201 });
  } catch (error) {
    console.error('Error creating secondary listing:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
