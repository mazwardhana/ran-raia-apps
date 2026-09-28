import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get('limit'));
  const unreadOnly = url.searchParams.get('unread') === '1';

  const where = {
    userId: user.id,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  // unreadCount dihitung dari halaman yang dikembalikan (bukan count() terpisah)
  // supaya badge selalu konsisten dengan daftar yang dilihat user.
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const unreadCount = notifications.filter((n: { isRead: boolean }) => !n.isRead).length;

  return NextResponse.json({ notifications, unreadCount });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
  }

  const payload = (body ?? {}) as { id?: unknown; all?: unknown };

  if (payload.all === true) {
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true, count: result.count });
  }

  if (typeof payload.id === 'string' && payload.id.length > 0) {
    const result = await prisma.notification.updateMany({
      where: { id: payload.id, userId: user.id },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true, count: result.count });
  }

  return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 });
}
