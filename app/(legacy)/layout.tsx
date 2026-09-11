import type { ReactNode } from 'react';
import Sidebar from '@/components/shell/sidebar';
import Topbar from '@/components/shell/topbar';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LegacyLayout({ children }: { children: ReactNode }) {
  const profile = await requireUser();
  return <div className="design-app-shell"><Sidebar role="user" /><div className="design-main"><Topbar title="월간 발주계획" profile={profile} /><main className="design-content">{children}</main></div></div>;
}
