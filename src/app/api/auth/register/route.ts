import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation';

const PASSWORD_SALT_ROUNDS = 12;

// Simpan username huruf kecil: kolom DB unik tapi hanya case-sensitive.
function normalizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const record = body as Record<string, unknown>;
  const username =
    typeof record.username === 'string' ? record.username.toLowerCase() : record.username;
  return { ...record, username };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body bukan JSON valid' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(normalizeBody(body));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
      { status: 400 }
    );
  }

  const { name, username, email, password, phone } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: username, mode: 'insensitive' } },
        { email: { equals: email, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Username atau email sudah digunakan' },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name,
      username,
      email,
      passwordHash,
      phone: phone ?? null,
      role: 'INVESTOR',
      kycStatus: 'PENDING',
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      kycStatus: true,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
