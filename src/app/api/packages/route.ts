import { NextRequest, NextResponse } from 'next/server';
import { AnimalType, PackageStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Parse and validate query params
  const search = searchParams.get('search') || undefined;
  const status = searchParams.get('status') || undefined;
  const animalType = searchParams.get('animalType') || undefined;
  const siteId = searchParams.get('siteId') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

  // Validation
  if (search && search.length > 100) {
    return NextResponse.json(
      { error: 'Search query too long' },
      { status: 400 }
    );
  }

  if (
    status &&
    !['DRAFT', 'OPEN', 'RUNNING', 'CLOSED', 'SOLD_OUT'].includes(status)
  ) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  if (animalType && !['KAMBING', 'SAPI'].includes(animalType)) {
    return NextResponse.json({ error: 'Invalid animalType' }, { status: 400 });
  }

  if (siteId && (siteId.length > 64 || siteId.trim().length === 0)) {
    return NextResponse.json({ error: 'Invalid siteId' }, { status: 400 });
  }

  if (page < 1 || !Number.isInteger(page)) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  }

  if (pageSize < 1 || pageSize > 100 || !Number.isInteger(pageSize)) {
    return NextResponse.json({ error: 'Invalid pageSize' }, { status: 400 });
  }

  // Build where clause
  const where: Prisma.PackageWhereInput = {};

  // Exclude DRAFT by default unless explicitly requested
  if (status) {
    where.status = status as PackageStatus;
  } else {
    where.status = { notIn: ['DRAFT'] };
  }

  if (animalType) {
    where.animalType = animalType as AnimalType;
  }

  if (siteId) {
    where.siteProjectId = siteId;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      prisma.package.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
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
          periodMonths: true,
          siteProject: {
            select: {
              id: true,
              name: true,
              legalEntity: true,
              city: true,
              province: true,
            },
          },
        },
      }),
      prisma.package.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
    });
  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
