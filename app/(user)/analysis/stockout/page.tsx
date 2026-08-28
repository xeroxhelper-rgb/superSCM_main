import PageHeader from '@/components/shell/page-header';
import Badge, { type StatusTone } from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import InsightBanner from '@/components/ui/insight-banner';
import { getStockoutKpi, getStockoutRisk } from '@/lib/scm';
import type { RiskStatus, StockoutRisk } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

function statusTone(status: RiskStatus): StatusTone {
  if (status === 'SAFE') return 'safe';
  if (status === 'WARNING') return 'warning';
  if (status === 'CRITICAL') return 'critical';
  return 'calculation_unavailable';
}

function numberCell(value: number | null, suffix = '', reason?: string | null) {
  if (value === null) return <EmptyValue reason={reason ?? 'NO_DATA'} />;
  return <span>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</span>;
}

const columns: UiColumn<StockoutRisk>[] = [
  { key: 'itemId', label: '품목' },
  { key: 'itemName', label: '품목명' },
  { key: 'supplier', label: '생산법인' },
  { key: 'availableQty', label: '가용재고', align: 'right', render: (row) => numberCell(row.availableQty) },
  { key: 'dailyUsageAvg', label: '일평균 사용량', align: 'right', render: (row) => numberCell(row.dailyUsageAvg, '', row.reason) },
  { key: 'stockoutDays', label: '소진예상일수', align: 'right', render: (row) => numberCell(row.stockoutDays, '일', row.reason) },
  { key: 'stockoutDate', label: '소진예상일', align: 'right', render: (row) => row.stockoutDate ? row.stockoutDate : <EmptyValue reason={row.reason ?? 'NO_DATA'} /> },
  { key: 'riskStatus', label: '상태', render: (row) => <Badge status={statusTone(row.riskStatus)}>{row.riskStatus}</Badge> },
];

export default async function StockoutPage() {
  const [{ rows, error }, kpiResult] = await Promise.all([getStockoutRisk(), getStockoutKpi()]);
  const kpi = kpiResult.data;
  const combinedError = error ?? kpiResult.error;
  return <>
    <PageHeader eyebrow="ANALYSIS / STOCKOUT RISK" title="재고 소진 위험" description="가용재고와 계획 리드타임 기준으로 품목별 소진 위험을 확인합니다." action={<Badge status="critical">RISK MONITOR</Badge>} />
    <div className="kpi-grid">
      <KpiCard label="분석 품목" value={kpi?.nItems ?? <EmptyValue reason={combinedError ? 'QUERY_ERROR' : 'NO_DATA'} />} foot="v_stockout_risk" status={combinedError ? 'calculation_unavailable' : 'info'} />
      <KpiCard label="CRITICAL" value={kpi?.nCritical ?? <EmptyValue reason={combinedError ? 'QUERY_ERROR' : 'NO_DATA'} />} foot="즉시 검토 필요" status="critical" />
      <KpiCard label="SAFE" value={kpi?.nSafe ?? <EmptyValue reason={combinedError ? 'QUERY_ERROR' : 'NO_DATA'} />} foot="계획 리드타임 내 안전" status="safe" />
      <KpiCard label="30일 이내" value={kpi?.nWithin30d ?? <EmptyValue reason={combinedError ? 'QUERY_ERROR' : 'NO_DATA'} />} foot="소진 예상 품목" status="warning" />
    </div>
    <div className="content-grid">
      <Panel title="품목별 재고 소진 위험" meta="ANALYTICS" className="span-8"><DataTable columns={columns} rows={rows} error={error} rowKey={(row) => row.itemId} empty="데이터가 없습니다. Exposed schemas와 analytics.v_stockout_risk를 확인하세요." /></Panel>
      <Panel title="판정 기준" meta="STATUS"><InsightBanner title="계산 불가를 위험 수치로 바꾸지 않습니다.">사용 이력이나 계획 리드타임이 없으면 소진일수는 `—`와 사유 코드로 표시합니다. SAFE·WARNING·CRITICAL은 DB 뷰의 결과를 그대로 표시합니다.</InsightBanner></Panel>
    </div>
  </>;
}
