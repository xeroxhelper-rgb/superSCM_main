import PageHeader from '@/components/shell/page-header';
import Badge, { type StatusTone } from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import InsightBanner from '@/components/ui/insight-banner';
import { getLeadtimeGap } from '@/lib/scm';
import type { LeadtimeGap } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

function numberCell(value: number | null, suffix = '') {
  if (value === null) return <EmptyValue reason="NO_DATA" />;
  return <span>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</span>;
}

function gapStatus(row: LeadtimeGap): StatusTone {
  if (row.gap === null) return 'calculation_unavailable';
  return row.gap > 0 ? 'critical' : 'safe';
}

const columns: UiColumn<LeadtimeGap>[] = [
  { key: 'supplier', label: '공급처' },
  { key: 'country', label: '국가' },
  { key: 'masterLeadTime', label: '마스터', align: 'right', render: (row) => numberCell(row.masterLeadTime, '일') },
  { key: 'sampleCount', label: '표본수', align: 'right', render: (row) => row.sampleCount.toLocaleString() },
  { key: 'actualAverage', label: '실적평균', align: 'right', render: (row) => numberCell(row.actualAverage, '일') },
  { key: 'p80', label: 'P80', align: 'right', render: (row) => numberCell(row.p80, '일') },
  { key: 'gap', label: '격차', align: 'right', render: (row) => row.gap === null ? <EmptyValue reason="NO_DATA" /> : <Badge status={gapStatus(row)}>{row.gap > 0 ? `+${row.gap}일` : `${row.gap}일`}</Badge> },
];

export default async function LeadtimePage() {
  const { rows, error } = await getLeadtimeGap();
  return <>
    <PageHeader eyebrow="ANALYSIS / LEAD TIME" title="리드타임 격차" description="마스터 표준 리드타임과 실제 실적 P80을 비교해 계획이 현실보다 짧게 잡힌 공급처를 찾습니다." action={<Badge status="safe">SUPABASE LIVE</Badge>} />
    <div className="kpi-grid">
      <KpiCard label="공급처" value={error ? <EmptyValue reason="QUERY_ERROR" /> : rows.length} foot="분석 결과 행 수" status={error ? 'calculation_unavailable' : 'safe'} />
      <KpiCard label="기준 지표" value="P80" foot="실제 리드타임 분위수" status="info" />
      <KpiCard label="데이터 계층" value="analytics" foot="v_leadtime_gap" status="info" />
      <KpiCard label="계산 불가" value={error ? <EmptyValue reason="QUERY_ERROR" /> : '—'} foot="null 값은 원인 코드로 표시" status="calculation_unavailable" />
    </div>
    <div className="content-grid">
      <Panel title="공급처별 리드타임" meta="P80 − 마스터" className="span-8"><DataTable columns={columns} rows={rows} error={error} rowKey={(row, index) => `${row.supplier}-${index}`} empty="데이터가 없습니다. Exposed schemas와 analytics.v_leadtime_gap을 확인하세요." /></Panel>
      <Panel title="해석 기준" meta="STATUS"><InsightBanner title="양수 격차는 계획 위험입니다.">P80이 마스터보다 길면 실제 공급 소요가 계획보다 긴 상태입니다. 표본 부족이나 값 누락은 숫자로 보정하지 않습니다.</InsightBanner></Panel>
    </div>
  </>;
}
