import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

import { saveKycPhoto } from './storage';
import { asUploadedFile, validateKycImage, validateKycText } from './validation';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { kycStatus: true },
  });

  return NextResponse.json({ kycStatus: dbUser?.kycStatus || 'PENDING' });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);

  if (!form) {
    return NextResponse.json({ error: 'Bentuk permintaan tidak valid.' }, { status: 400 });
  }

  const textError = validateKycText(form);
  if (textError) {
    return NextResponse.json({ error: textError }, { status: 400 });
  }

  const ktpImage = asUploadedFile(form.get('ktpImage'));
  if (!ktpImage) {
    return NextResponse.json({ error: 'Foto KTP wajib diunggah.' }, { status: 400 });
  }
  const ktpError = validateKycImage(ktpImage, 'Foto KTP');
  if (ktpError) {
    return NextResponse.json({ error: ktpError }, { status: 400 });
  }

  const selfieImage = asUploadedFile(form.get('selfieImage'));
  if (!selfieImage) {
    return NextResponse.json({ error: 'Foto selfie wajib diunggah.' }, { status: 400 });
  }
  const selfieError = validateKycImage(selfieImage, 'Foto selfie');
  if (selfieError) {
    return NextResponse.json({ error: selfieError }, { status: 400 });
  }

  try {
    const [ktpImagePath, selfieImagePath] = await Promise.all([
      saveKycPhoto(user.id, 'ktp', ktpImage),
      saveKycPhoto(user.id, 'selfie', selfieImage),
    ]);

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { ktpImagePath, selfieImagePath },
      create: { userId: user.id, ktpImagePath, selfieImagePath },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { kycStatus: 'VERIFIED' },
    });
  } catch (error) {
    console.error('[kyc] gagal menyimpan data KYC:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan data KYC. Silakan coba lagi.' },
      { status: 500 }
    );
  }

  await createNotification({
    userId: user.id,
    type: 'KYC',
    title: 'KYC diverifikasi',
    body: 'Identitas Anda telah disetujui. Fitur investasi kini terbuka penuh.',
  });

  return NextResponse.json({ verified: true });
}
