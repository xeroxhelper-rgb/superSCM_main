'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { menuByRole, type MenuRole } from '@/lib/menu';

export default function Sidebar({ role }: { role: MenuRole }) {
  const pathname = usePathname();
  const menus = menuByRole[role];

  return (
    <aside className="design-sidebar">
      <div className="design-brand">
        <div className="design-brand-mark">OP</div>
        <div className="design-brand-copy">
          <strong>월간 발주계획</strong>
          <span>Procurement Planning</span>
        </div>
      </div>
      <div className="design-nav-group">
        <div className="design-nav-label">{role === 'admin' ? 'ADMIN' : 'WORKSPACE'}</div>
        <nav className="design-nav-list" aria-label={`${role} 메뉴`}>
          {menus.map((item) => {
            const Icon = item.icon;
            const locked = item.status === 'locked';
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return locked ? (
              <span key={item.href} className="design-nav-item locked" aria-disabled="true">
                <span className="design-nav-icon"><Icon size={15} /></span>
                <span>{item.label}</span>
                <LockKeyhole size={12} aria-hidden="true" />
              </span>
            ) : (
              <Link key={item.href} href={item.href} className={`design-nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="design-nav-icon"><Icon size={15} /></span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="design-sidebar-foot">
        <strong>2026년 09월 발주계획</strong><br />
        {role === 'admin' ? '관리자 화면 · Phase 1' : '사용자 화면 · Phase 1'}
      </div>
    </aside>
  );
}
