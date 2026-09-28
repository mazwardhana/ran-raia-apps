import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { contentTypeForPath, readKycPhoto, type KycPhotoType } from '../storage';

const PHOTO_TYPES: KycPhotoType[] = ['ktp', 'selfie'];

/**
 * Menyajikan foto KTP/selfie milik pengguna yang sedang login saja. Berkas
 * disimpan di luar `public/`, jadi hanya bisa diambil lewat endpoint ini.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get('type');
  if (!type || !PHOTO_TYPES.includes(type as KycPhotoType)) {
    return NextResponse.json({ error: 'Jenis foto tidak valid.' }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
  });

  const storedPath =
    type === 'ktp' ? profile?.ktpImagePath : profile?.selfieImagePath;

  if (!storedPath) {
    return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 });
  }

  const bytes = await readKycPhoto(storedPath);

  if (!bytes) {
    return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 });
  }

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForPath(storedPath),
      'Cache-Control': 'private, no-store',
    },
  });
}
