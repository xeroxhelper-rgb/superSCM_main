import Badge from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { LeadtimePolicy, LeadtimePolicyHistory } from '@/lib/scm-model';
import { updateLeadtimePolicyAction } from '@/app/(admin)/admin/scm-policies/leadtime/actions';

function value(number: number | null) { return number === null ? <EmptyValue reason="NO_DATA" /> : `${number}일`; }

const columns: UiColumn<LeadtimePolicy>[] = [
  { key: 'supplierId', label: 'Supplier' },
  { key: 'supplierName', label: '공급처' },
  { key: 'p50', label: 'P50', align: 'right', render: (row) => value(row.p50) },
  { key: 'p80', label: 'P80', align: 'right', render: (row) => value(row.p80) },
  { key: 'p90', label: 'P90', align: 'right', render: (row) => value(row.p90) },
  { key: 'confirmedLeadTime', label: '관리자 확정', align: 'right', render: (row) => value(row.confirmedLeadTime) },
  { key: 'effectiveLeadTime', label: 'Effective', align: 'right', render: (row) => value(row.effectiveLeadTime) },
  { key: 'effectiveSource', label: '적용 기준', render: (row) => row.effectiveSource ? <Badge status="info">{row.effectiveSource}</Badge> : <EmptyValue reason={row.reasonCode ?? 'NO_LEADTIME'} /> },
  { key: 'effectiveFrom', label: '적용일', render: (row) => row.effectiveFrom ?? <EmptyValue reason="NOT_CONFIGURED" /> },
  { key: 'actions', label: '정책 변경', render: (row) => <form action={updateLeadtimePolicyAction} className="admin-control"><input type="hidden" name="supplier_id" value={row.supplierId} /><input name="lead_time" type="number" min="0" required placeholder="일" aria-label={`${row.supplierId} Lead Time`} /><input name="effective_from" type="date" required aria-label={`${row.supplierId} 적용일`} /><input name="reason" required placeholder="변경 사유" aria-label={`${row.supplierId} 변경 사유`} /><button className="button-ui" type="submit">저장</button></form> },
];

export default function LeadtimePolicyTable({ rows, error }: { rows: LeadtimePolicy[]; error: string | null }) {
  return <DataTable columns={columns} rows={rows} error={error} rowKey={(row) => row.supplierId} empty="Lead Time 정책 데이터가 없습니다." />;
}

export function LeadtimeHistoryTable({ rows, error }: { rows: LeadtimePolicyHistory[]; error: string | null }) {
  const historyColumns: UiColumn<LeadtimePolicyHistory>[] = [
    { key: 'supplierId', label: 'Supplier' },
    { key: 'previousLeadTime', label: '이전값', render: (row) => value(row.previousLeadTime) },
    { key: 'nextLeadTime', label: '변경값', render: (row) => value(row.nextLeadTime) },
    { key: 'effectiveFrom', label: '적용일' },
    { key: 'reason', label: '사유' },
    { key: 'changedAt', label: '변경일시' },
  ];
  return <DataTable columns={historyColumns} rows={rows} error={error} rowKey={(row) => String(row.historyId)} empty="Lead Time 변경 이력이 없습니다." />;
}
