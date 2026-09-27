import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PackageStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireRole, type CurrentUser } from '@/lib/auth';
import { packageSchema } from '@/lib/validation';

const PACKAGE_STATUSES = [
  'DRAFT',
  'OPEN',
  'RUNNING',
  'CLOSED',
  'SOLD_OUT',
] as const;

const packageInputSchema = packageSchema.extend({
  code: z
    .string()
    .min(1, 'Kode paket wajib diisi')
    .max(50, 'Kode paket maksimal 50 karakter'),
  status: z.enum(PACKAGE_STATUSES, {
    errorMap: () => ({ message: 'Status paket tidak valid' }),
  }),
});

type AuthOk = { ok: true; user: CurrentUser };
type AuthFail = { ok: false; response: NextResponse };
type AuthResult = AuthOk | AuthFail;

async function authorize(): Promise<AuthResult> {
  try {
    const user = await requireRole(['OPERATOR', 'ADMIN']);
    return { ok: true, user };
  } catch (error) {
    const err = error as { name?: string; code?: string };
    if (
      err?.name === 'AuthenticationError' ||
      err?.code === 'UNAUTHENTICATED' ||
      err?.code === 'FORBIDDEN'
    ) {
      const unauthenticated = err.code !== 'FORBIDDEN';
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: unauthenticated
              ? 'Silakan login terlebih dahulu.'
              : 'Anda tidak memiliki akses ke resource ini.',
          },
          { status: unauthenticated ? 401 : 403 }
        ),
      };
    }
    throw error;
  }
}

function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Data tidak valid.';
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}

function toDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || undefined;
  const status = searchParams.get('status') || undefined;
  const page = Math.max(
    1,
    parseInt(searchParams.get('page') || '1', 10) || 1
  );
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10) || 10)
  );

  if (status && !PACKAGE_STATUSES.includes(status as PackageStatus)) {
    return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
  }

  const where: Prisma.PackageWhereInput = {};
  if (status) where.status = status as PackageStatus;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
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
          status: true,
          price: true,
          lotPrice: true,
          totalLots: true,
          soldLots: true,
          periodMonths: true,
          maxInvestors: true,
          coverImage: true,
          description: true,
          createdAt: true,
          siteProject: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.package.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = packageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 }
    );
  }
  const data = parsed.data;

  try {
    const existing = await prisma.package.findFirst({
      where: { code: data.code },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Kode paket sudah digunakan.' },
        { status: 409 }
      );
    }

    const created = await prisma.package.create({
      data: {
        code: data.code,
        title: data.title,
        animalType: data.animalType,
        siteProjectId: data.siteProjectId,
        periodMonths: data.periodMonths,
        price: data.price,
        lotPrice: data.lotPrice,
        totalLots: data.totalLots,
        maxInvestors: data.maxInvestors,
        status: data.status,
        description: data.description,
        estimatedRoi: data.estimatedRoi,
        estimatedOffspring: data.estimatedOffspring,
        estimatedOffspringPrice: data.estimatedOffspringPrice,
        estimatedMilkMonthly: data.estimatedMilkMonthly,
        estimatedMilkPrice: data.estimatedMilkPrice,
        startDate: toDate(data.startDate),
        endDate: toDate(data.endDate),
        costs: {
          create: data.costs.map((cost) => ({
            costType: cost.costType,
            amount: cost.amount,
            description: cost.description,
          })),
        },
      },
      select: { id: true, code: true, title: true },
    });

    return NextResponse.json(
      { id: created.id, code: created.code, title: created.title },
      { status: 201 }
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'Kode paket sudah digunakan.' },
        { status: 409 }
      );
    }
    console.error('Error creating package:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: 'Paket tidak ditemukan.' },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = packageInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 }
    );
  }
  const data = parsed.data;

  try {
    const existing = await prisma.package.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Paket tidak ditemukan.' },
        { status: 404 }
      );
    }

    const duplicate = await prisma.package.findFirst({
      where: { code: data.code, NOT: { id } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'Kode paket sudah digunakan.' },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.package.update({
        where: { id },
        data: {
          code: data.code,
          title: data.title,
          animalType: data.animalType,
          siteProjectId: data.siteProjectId,
          periodMonths: data.periodMonths,
          price: data.price,
          lotPrice: data.lotPrice,
          totalLots: data.totalLots,
          maxInvestors: data.maxInvestors,
          status: data.status,
          description: data.description,
          estimatedRoi: data.estimatedRoi,
          estimatedOffspring: data.estimatedOffspring,
          estimatedOffspringPrice: data.estimatedOffspringPrice,
          estimatedMilkMonthly: data.estimatedMilkMonthly,
          estimatedMilkPrice: data.estimatedMilkPrice,
          startDate: toDate(data.startDate),
          endDate: toDate(data.endDate),
        },
      }),
      prisma.packageCost.deleteMany({ where: { packageId: id } }),
      prisma.packageCost.createMany({
        data: data.costs.map((cost) => ({
          packageId: id,
          costType: cost.costType,
          amount: cost.amount,
          description: cost.description,
        })),
      }),
    ]);

    return NextResponse.json({ id, code: data.code, title: data.title });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'Kode paket sudah digunakan.' },
        { status: 409 }
      );
    }
    console.error('Error updating package:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: 'Paket tidak ditemukan.' },
      { status: 404 }
    );
  }

  try {
    const existing = await prisma.package.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Paket tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Hanya paket berstatus Draf yang dapat dihapus.' },
        { status: 409 }
      );
    }

    await prisma.package.delete({ where: { id } });

    return NextResponse.json({ id });
  } catch (error) {
    console.error('Error deleting package:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server.' },
      { status: 500 }
    );
  }
}
