import PageHeader from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import InsightBanner from '@/components/ui/insight-banner';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import DemandProfileTable from '@/components/analysis/demand-profile-table';
import { getDemandProfile, getDemandProfileKpi } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function DemandProfilePage() {
  const [{ rows, error: profileError }, { data: kpi, error: kpiError }] = await Promise.all([getDemandProfile(), getDemandProfileKpi()]);
  const error = profileError ?? kpiError;
  return <>
    <PageHeader eyebrow="ANALYSIS / DEMAND PROFILE" title="SKU 수요 프로파일" description="학습 구간의 월별 수요 특성을 분석해 Forecast 모델 후보 선택에 사용할 패턴을 확인합니다." action={<Badge status="safe">TRAIN DATA ONLY</Badge>} />
    <div className="kpi-grid">
      <KpiCard label="분석 SKU" value={error ? <EmptyValue reason="QUERY_ERROR" /> : kpi?.totalItems ?? <EmptyValue reason="NO_KPI" />} foot="analytics.v_sku_demand_profile" status={error ? 'calculation_unavailable' : 'info'} />
      <KpiCard label="SMOOTH" value={error ? <EmptyValue reason="QUERY_ERROR" /> : kpi?.nSmooth ?? <EmptyValue reason="NO_KPI" />} foot="안정적·빈번한 수요" status="safe" />
      <KpiCard label="Croston 대상" value={error ? <EmptyValue reason="QUERY_ERROR" /> : kpi?.nCrostonNeeded ?? <EmptyValue reason="NO_KPI" />} foot="INTERMITTENT + LUMPY" status="warning" />
      <KpiCard label="계산 불가" value={error ? <EmptyValue reason="QUERY_ERROR" /> : kpi?.nCalculationUnavailable ?? <EmptyValue reason="NO_KPI" />} foot="reason code 확인 필요" status="calculation_unavailable" />
    </div>
    <div className="content-grid">
      <Panel title="SKU별 수요 특성" meta="SBC CLASSIFICATION" className="span-8">
        {error ? <DataError message={error} /> : <DemandProfileTable rows={rows} />}
      </Panel>
      <Panel title="분석 기준" meta="TRAIN WINDOW">
        <InsightBanner title="검증 기간은 분석에서 제외됩니다.">월별 기간 Grid는 Forecast 설정의 학습 시작월부터 종료월까지 생성됩니다. 데이터가 부족하거나 null인 지표는 숫자로 보정하지 않고 reason code와 함께 표시합니다.</InsightBanner>
      </Panel>
    </div>
  </>;
}

function DataError({ message }: { message: string }) {
  return <p className="empty-state-ui"><strong>조회에 실패했습니다.</strong><br />{message}</p>;
}
