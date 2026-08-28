import type { ReactNode } from 'react';
import Link from 'next/link';
import AnalysisTabs from '@/components/shell/analysis-tabs';

export default function UserAnalysisLayout({ children }: { children: ReactNode }) {
  return <><div className="analysis-route-header"><Link className="button-ui" href="/">← 전체 현황</Link><AnalysisTabs /></div>{children}</>;
}
