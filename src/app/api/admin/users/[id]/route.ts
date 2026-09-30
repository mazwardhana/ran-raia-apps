import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Ubah status KYC dan/atau role seorang pengguna (RULING 20).
 *
 * `role` hanya boleh diubah ADMIN; `kycStatus` boleh ADMIN maupun OPERATOR.
 * `Role.SYSTEM` tidak ada di daftar role yang diizinkan, sehingga akun internal
 * tidak pernah bisa ditetapkan lewat API — dan akun yang sudah SYSTEM ditolak.
 */

const updateUserSchema = z
  .object({
    kycStatus: z
      .enum(['PENDING', 'VERIFIED', 'REJECTED'], {
        errorMap: () => ({ message: 'Status KYC tidak valid' }),
      })
      .optional(),
    role: z
      .enum(['ADMIN', 'OPERATOR', 'INVESTOR'], {
        errorMap: () => ({ message: 'Role tidak valid' }),
      })
      .optional(),
  })
  .strict();

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json().catch(() => null);
  const wantsRoleChange =
    typeof body === 'object' && body !== null && body.role !== undefined;

  try {
    await requireRole(wantsRoleChange ? ['ADMIN'] : ['ADMIN', 'OPERATOR']);
  } catch (error) {
    return deny(error);
  }

  const validation = updateUserSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message || 'Data tidak valid' },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true },
    });

    if (!existing || existing.role === 'SYSTEM') {
      return NextResponse.json(
        { error: 'Pengguna tidak ditemukan' },
        { status: 404 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(validation.data.kycStatus
          ? { kycStatus: validation.data.kycStatus }
          : {}),
        ...(validation.data.role ? { role: validation.data.role } : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        kycStatus: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error);
    return NextResponse.json(
      { error: 'Gagal memperbarui pengguna' },
      { status: 500 }
    );
  }
}
