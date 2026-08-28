import Link from 'next/link';
import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import InsightBanner from '@/components/ui/insight-banner';

export default function UserDashboardPage() {
  return <>
    <PageHeader eyebrow="PLANNING RUN / 2026.09" title="월간 발주계획 현황" description="수요 확정부터 분석 결과 확인까지, 이번 달 공급망 상태를 한 곳에서 확인합니다." action={<Button variant="primary" href="/analysis/stockout">재고 위험 확인</Button>} />
    <div className="kpi-grid">
      <KpiCard label="분석 공급처" value="12" foot="리드타임 분석 대상" status="safe" />
      <KpiCard label="재고 위험 품목" value="—" foot="분석 결과 확인 필요" status="calculation_unavailable" />
      <KpiCard label="계획 기준월" value="09" foot="2026년 09월" status="info" />
      <KpiCard label="현재 단계" value="분석" foot="데이터 기반 검토" status="info" />
    </div>
    <div className="content-grid">
      <Panel title="분석 화면" meta="USER WORKSPACE" className="span-8">
        <div className="content-grid">
          <Link className="panel span-6" href="/analysis/leadtime"><Badge status="info">LEAD TIME</Badge><h3>리드타임 격차</h3><p className="muted-ui">마스터 기준과 실제 P80을 공급처별로 비교합니다.</p></Link>
          <Link className="panel span-6" href="/analysis/stockout"><Badge status="critical">STOCKOUT RISK</Badge><h3>재고 소진 위험</h3><p className="muted-ui">가용재고와 계획 리드타임 기준의 위험 품목을 확인합니다.</p></Link>
        </div>
      </Panel>
      <Panel title="업무 상태" meta="PHASE 1" className="span-4">
        <InsightBanner title="데이터 검토부터 시작하세요">분석 결과를 확인한 뒤 수요·재고·마스터 확정 단계로 연결할 수 있습니다.</InsightBanner>
      </Panel>
    </div>
  </>;
}
