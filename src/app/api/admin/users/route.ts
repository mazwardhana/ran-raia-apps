import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Daftar pengguna untuk konsol operator.
 *
 * Akun `Role.SYSTEM` (mis. `raia_treasury`) dikecualikan agar akun internal
 * tidak muncul — dan karenanya tidak bisa diubah — dari konsol (RULING 21).
 * Pencarian opsional `?search=` mencocokkan username/nama/email.
 */

function deny(error: unknown): NextResponse {
  const code = (error as { code?: string })?.code;
  if (code === 'UNAUTHENTICATED') {
    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu' },
      { status: 401 }
    );
  }
  return NextResponse.json(
    { error: 'Anda tidak memiliki akses ke halaman operator' },
    { status: 403 }
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['ADMIN', 'OPERATOR']);
  } catch (error) {
    return deny(error);
  }

  try {
    const search = new URL(request.url).searchParams.get('search')?.trim();

    const where: Prisma.UserWhereInput = { role: { not: 'SYSTEM' } };
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        kycStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/admin/users error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat daftar pengguna' },
      { status: 500 }
    );
  }
}
