'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { analysisMenuItems } from '@/lib/menu';

export default function AnalysisTabs() {
  const pathname = usePathname();
  return <nav className="analysis-tabs-ui" aria-label="분석 메뉴">{analysisMenuItems.map((item) => <Link key={item.href} href={item.href} className={`analysis-tab-ui ${pathname === item.href ? 'active' : ''}`} aria-current={pathname === item.href ? 'page' : undefined}>{item.label}</Link>)}</nav>;
}
