import Badge, { type StatusTone } from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { InventoryProjection, RiskStatus } from '@/lib/scm-model';

function tone(status: RiskStatus): StatusTone {
  return status === 'SAFE' ? 'safe' : status === 'WARNING' ? 'warning' : status === 'CRITICAL' ? 'critical' : 'calculation_unavailable';
}

function numberCell(value: number | null, reason: string | null) {
  return value === null ? <EmptyValue reason={reason ?? 'NO_DATA'} /> : <span>{Number.isInteger(value) ? value : value.toFixed(1)}</span>;
}

const columns: UiColumn<InventoryProjection>[] = [
  { key: 'itemId', label: 'SKU' },
  { key: 'itemName', label: '품목명' },
  { key: 'period', label: 'Period' },
  { key: 'beginningInventory', label: 'Beginning Inventory', align: 'right', render: (row) => numberCell(row.beginningInventory, row.reasonCode) },
  { key: 'scheduledReceipt', label: 'Scheduled Receipt', align: 'right', render: (row) => numberCell(row.scheduledReceipt, row.reasonCode) },
  { key: 'confirmedSalesOrder', label: 'Confirmed Sales Order', align: 'right', render: (row) => numberCell(row.confirmedSalesOrder, row.reasonCode) },
  { key: 'softAllocation', label: 'Soft Allocation', align: 'right', render: (row) => numberCell(row.softAllocation, row.reasonCode) },
  { key: 'forecastDemand', label: 'Forecast Demand', align: 'right', render: (row) => numberCell(row.forecastDemand, row.reasonCode) },
  { key: 'endingProjectedInventory', label: 'Ending Projected Inventory', align: 'right', render: (row) => numberCell(row.endingProjectedInventory, row.reasonCode) },
  { key: 'reasonCode', label: 'Reason', render: (row) => row.reasonCode ? <EmptyValue reason={row.reasonCode} /> : <span>—</span> },
];

export default function InventoryProjectionTable({ rows, error }: { rows: InventoryProjection[]; error: string | null }) {
  return <DataTable columns={columns} rows={rows} error={error} rowKey={(row) => `${row.itemId}-${row.period}`} empty="Projection 데이터가 없습니다. Forecast 실행 결과와 Exposed schemas를 확인하세요." />;
}

export function riskBadge(status: RiskStatus) {
  return <Badge status={tone(status)}>{status}</Badge>;
}
