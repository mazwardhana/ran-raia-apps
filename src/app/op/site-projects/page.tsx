import { prisma } from '@/lib/prisma';

import { SiteProjectList, type SiteProjectRow } from './SiteProjectList';

export const dynamic = 'force-dynamic';

export default async function SiteProjectsPage() {
  const rows = await prisma.siteProject.findMany({ orderBy: { createdAt: 'desc' } });

  return <SiteProjectList rows={(rows ?? []) as unknown as SiteProjectRow[]} />;
}
