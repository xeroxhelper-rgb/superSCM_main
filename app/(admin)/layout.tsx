import type { ReactNode } from 'react';
import Sidebar from '@/components/shell/sidebar';
import Topbar from '@/components/shell/topbar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="design-app-shell"><Sidebar role="admin" /><div className="design-main"><Topbar eyebrow="SCM ADMIN CONTROL" title="관리자 콘솔" /><main className="design-content">{children}</main></div></div>;
}
