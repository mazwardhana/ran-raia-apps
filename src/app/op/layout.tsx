import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { OperatorShell } from '@/components/operator/OperatorShell';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function OperatorLayout({ children }: { children: ReactNode }) {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch {
    redirect('/app');
  }

  return <OperatorShell>{children}</OperatorShell>;
}
