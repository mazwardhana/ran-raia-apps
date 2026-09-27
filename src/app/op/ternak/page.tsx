import { Box, Stack, Title } from '@mantine/core';
import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import { TernakInitial, TernakView } from './TernakView';

export const dynamic = 'force-dynamic';

interface PackageLite {
  animalType: string;
  siteProject: { name: string } | null;
}

export default async function OperatorTernakPage() {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch {
    redirect('/');
  }

  const pageSize = 10;
  const [total, activeRows, firstPage] = await Promise.all([
    prisma.livestock.count(),
    prisma.livestock.findMany({
      where: { status: 'ACTIVE' },
      select: {
        package: {
          select: { animalType: true, siteProject: { select: { name: true } } },
        },
      },
    }),
    prisma.livestock.findMany({
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      include: {
        package: {
          select: {
            code: true,
            animalType: true,
            siteProject: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const byAnimalType: Record<string, number> = {};
  const bySite: Record<string, number> = {};
  for (const row of activeRows as { package: PackageLite | null }[]) {
    const type = row.package?.animalType ?? 'LAIN';
    byAnimalType[type] = (byAnimalType[type] ?? 0) + 1;
    const site = row.package?.siteProject?.name ?? 'Tanpa Site';
    bySite[site] = (bySite[site] ?? 0) + 1;
  }

  const initial: TernakInitial = {
    total,
    items: firstPage.map((item) => ({
      id: item.id,
      tagNumber: item.tagNumber,
      name: item.name,
      sex: item.sex,
      breed: item.breed,
      weightKg: item.weightKg,
      status: item.status,
      packageCode: item.package.code,
      animalType: item.package.animalType,
      siteName: item.package.siteProject?.name ?? '-',
    })),
    aggregates: {
      byAnimalType: Object.entries(byAnimalType).map(([label, value]) => ({
        label,
        value,
      })),
      bySite: Object.entries(bySite).map(([label, value]) => ({ label, value })),
    },
  };

  return (
    <Box p="md">
      <Stack gap="md">
        <Title order={1}>Manajemen Ternak</Title>
        <TernakView initial={initial} />
      </Stack>
    </Box>
  );
}
