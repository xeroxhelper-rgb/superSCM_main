import type { ReactNode } from 'react';
import Sidebar from '@/components/shell/sidebar';
import Topbar from '@/components/shell/topbar';

export default function UserLayout({ children }: { children: ReactNode }) {
  return <div className="design-app-shell"><Sidebar role="user" /><div className="design-main"><Topbar title="월간 발주계획" /><main className="design-content">{children}</main></div></div>;
}
