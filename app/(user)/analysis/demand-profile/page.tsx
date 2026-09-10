import PageHeader from '@/components/shell/page-header';
import Badge, { type StatusTone } from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import Panel from '@/components/ui/panel';
import { getItemDemandProfiles } from '@/lib/scm';
import type { ItemDemandProfile } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

function value(value: number | null, suffix = '') {
  return value === null ? <EmptyValue reason="NO_DATA" /> : <span>{Number.isInteger(value) ? value : value.toFixed(2)}{suffix}</span>;
}

function typeStatus(type: ItemDemandProfile['demandType']): StatusTone {
  return type === 'SMOOTH' ? 'safe' : type === 'INTERMITTENT' || type === 'LUMPY' ? 'warning' : type === 'ERRATIC' ? 'critical' : 'calculation_unavailable';
}

const columns: UiColumn<ItemDemandProfile>[] = [
  { key: 'itemCode', label: 'SKU' },
  { key: 'description', label: '품목명', render: (row) => row.description ?? <EmptyValue reason="NO_ITEM_NAME" /> },
  { key: 'adi', label: 'ADI', align: 'right', render: (row) => value(row.adi) },
  { key: 'cvSquared', label: 'CV²', align: 'right', render: (row) => value(row.cvSquared) },
  { key: 'zeroDemandRate', label: 'Zero-demand', align: 'right', render: (row) => value(row.zeroDemandRate, '') },
  { key: 'demandType', label: '수요 유형', render: (row) => row.demandType ? <Badge status={typeStatus(row.demandType)}>{row.demandType}</Badge> : <EmptyValue reason={row.reasonCode ?? 'CALCULATION_UNAVAILABLE'} /> },
  { key: 'reasonCode', label: '사유', render: (row) => row.reasonCode ? <span className="muted">{row.reasonCode}</span> : <span>—</span> },
];

export default async function DemandProfilePage() {
  const { rows, error } = await getItemDemandProfiles();
  return <><PageHeader eyebrow="ANALYSIS / DEMAND PROFILE" title="수요 패턴" description="실출고 데이터의 수요 성격을 유형별로 확인합니다." action={<Badge status="info">ANALYTICS VIEW</Badge>} /><Panel title="SKU Demand Profile" meta={`${rows.length.toLocaleString()}개 품목`}><DataTable columns={columns} rows={rows} error={error} rowKey={(row) => row.itemCode} empty="v_item_demand_profile 결과가 없습니다. Exposed schemas와 View를 확인하세요." /></Panel></>;
}
