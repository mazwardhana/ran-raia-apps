import { prisma } from '@/lib/prisma';

import { PaketList, type PaketRow } from './PaketList';

export const dynamic = 'force-dynamic';

export default async function PaketPage() {
  const [rows, sites] = await Promise.all([
    prisma.package.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        siteProject: { select: { id: true, name: true } },
      },
    }),
    prisma.siteProject.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <PaketList
      rows={(rows ?? []) as unknown as PaketRow[]}
      sites={(sites ?? []) as unknown as Array<{ id: string; name: string }>}
    />
  );
}
