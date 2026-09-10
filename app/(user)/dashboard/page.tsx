import PageHeader from '@/components/shell/page-header';
import InsightBanner from '@/components/ui/insight-banner';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return <section className="analysis-page"><PageHeader eyebrow="OVERVIEW" title="전체 현황" description="실데이터 기반 분석 결과와 운영 상태를 확인합니다." /><div className="kpi-grid"><KpiCard label="분석 화면" value="4" foot="수요·OL·리드타임·재고" status="info" /><KpiCard label="운영 기준월" value="2026.09" foot="월간 발주계획" status="info" /><KpiCard label="데이터 상태" value="LIVE" foot="Supabase analytics" status="safe" /></div><Panel title="SCM Intelligence" meta="공급망 운영 콘솔"><InsightBanner title="분석 결과를 먼저 확인하세요">수요 패턴과 OL 예측 정확도는 실데이터 View를 조회합니다. 재고와 리드타임 데이터가 없으면 계산불가 상태로 표시합니다.</InsightBanner></Panel></section>;
}
