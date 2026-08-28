import type { ReactNode } from 'react';
import Sidebar from '@/components/shell/sidebar';
import Topbar from '@/components/shell/topbar';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <div className="design-app-shell"><Sidebar role="admin" /><div className="design-main"><Topbar eyebrow="SCM ADMIN CONTROL" title="관리자 콘솔" /><main className="design-content">{children}</main></div></div>;
}
