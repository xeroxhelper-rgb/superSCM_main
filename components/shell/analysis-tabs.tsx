'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { menuByRole } from '@/lib/menu';

export default function AnalysisTabs() {
  const pathname = usePathname();
  const items = menuByRole.user.filter((item) => item.href.startsWith('/analysis/'));
  return <nav className="analysis-tabs-ui" aria-label="분석 메뉴">{items.map((item) => <Link key={item.href} href={item.href} className={`analysis-tab-ui ${pathname === item.href ? 'active' : ''}`} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)}</nav>;
}
