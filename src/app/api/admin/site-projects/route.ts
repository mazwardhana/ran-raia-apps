import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { AuthenticationError, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { siteProjectSchema } from '@/lib/validation';

async function guard(): Promise<NextResponse | null> {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
    return null;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      const status = error.code === 'FORBIDDEN' ? 403 : 401;
      return NextResponse.json({ error: 'Akses ditolak.' }, { status });
    }
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? 'Data tidak valid.';
}

function generateCode(): string {
  return `SP-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || undefined;
    const status = searchParams.get('status') || undefined;

    const where: Prisma.SiteProjectWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { legalEntity: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (status === 'ACTIVE' || status === 'NONAKTIF') {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      prisma.siteProject.findMany({ where, orderBy: { createdAt: 'desc' } }),
      prisma.siteProject.count({ where }),
    ]);

    return NextResponse.json({ items, total });
  } catch (error) {
    console.error('GET site-projects error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = siteProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const data = parsed.data;

    const duplicate = await prisma.siteProject.findFirst({
      where: { legalEntity: { equals: data.legalEntity, mode: 'insensitive' } },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Badan usaha sudah terdaftar.' }, { status: 409 });
    }

    const siteProject = await prisma.siteProject.create({
      data: {
        code: generateCode(),
        name: data.name,
        legalEntity: data.legalEntity,
        legalNumber: data.legalNumber ?? null,
        npwp: data.npwp ?? null,
        address: data.address,
        province: data.province,
        city: data.city,
        village: data.village ?? '-',
        contactPerson: data.contactPerson ?? null,
        contactPhone: data.contactPhone ?? null,
        description: data.description ?? null,
        capacity: data.capacity,
        status: data.status,
      },
    });

    return NextResponse.json({ siteProject }, { status: 201 });
  } catch (error) {
    console.error('POST site-projects error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Site tidak ditemukan.' }, { status: 404 });
    }

    const existing = await prisma.siteProject.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Site tidak ditemukan.' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = siteProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const data = parsed.data;

    const duplicate = await prisma.siteProject.findFirst({
      where: {
        id: { not: id },
        legalEntity: { equals: data.legalEntity, mode: 'insensitive' },
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: 'Badan usaha sudah terdaftar.' }, { status: 409 });
    }

    const siteProject = await prisma.siteProject.update({
      where: { id },
      data: {
        name: data.name,
        legalEntity: data.legalEntity,
        legalNumber: data.legalNumber ?? null,
        npwp: data.npwp ?? null,
        address: data.address,
        province: data.province,
        city: data.city,
        village: data.village ?? '-',
        contactPerson: data.contactPerson ?? null,
        contactPhone: data.contactPhone ?? null,
        description: data.description ?? null,
        capacity: data.capacity,
        status: data.status,
      },
    });

    return NextResponse.json({ siteProject });
  } catch (error) {
    console.error('PUT site-projects error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Site tidak ditemukan.' }, { status: 404 });
    }

    const existing = await prisma.siteProject.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Site tidak ditemukan.' }, { status: 404 });
    }

    const packageCount = await prisma.package.count({
      where: { siteProjectId: id },
    });
    if (packageCount > 0) {
      return NextResponse.json(
        { error: 'Site masih memiliki paket aktif.' },
        { status: 409 }
      );
    }

    await prisma.siteProject.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE site-projects error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
