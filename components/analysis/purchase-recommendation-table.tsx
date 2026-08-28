import Link from 'next/link';
import Badge, { type StatusTone } from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { PurchaseRecommendation } from '@/lib/scm-model';

function tone(status: string | null): StatusTone {
  if (status === 'SAFE') return 'safe';
  if (status === 'WARNING') return 'warning';
  if (status === 'CRITICAL') return 'critical';
  return 'calculation_unavailable';
}

function numberCell(value: number | null, reason: string | null) {
  return value === null ? <EmptyValue reason={reason ?? 'NO_DATA'} /> : <span>{Number.isInteger(value) ? value : value.toFixed(1)}</span>;
}

const columns: UiColumn<PurchaseRecommendation>[] = [
  { key: 'itemId', label: 'SKU', render: (row) => <Link href={`/analysis/purchase-recommendation/${encodeURIComponent(row.itemId)}`}>{row.itemId}</Link> },
  { key: 'itemName', label: '품목명' },
  { key: 'riskStatus', label: 'Risk', render: (row) => <Badge status={tone(row.riskStatus)}>{row.riskStatus ?? 'CALCULATION_UNAVAILABLE'}</Badge> },
  { key: 'forecastQty', label: 'Forecast', align: 'right', render: (row) => numberCell(row.forecastQty, row.reasonCode) },
  { key: 'confirmedOrderQty', label: 'Confirmed Order', align: 'right', render: (row) => numberCell(row.confirmedOrderQty, row.reasonCode) },
  { key: 'availableInventory', label: 'Inventory', align: 'right', render: (row) => numberCell(row.availableInventory, row.reasonCode) },
  { key: 'safetyStock', label: 'Safety Stock', align: 'right', render: (row) => numberCell(row.safetyStock, row.reasonCode) },
  { key: 'stockoutDate', label: 'Stockout Date', render: (row) => row.stockoutDate ?? <EmptyValue reason={row.reasonCode ?? 'NO_STOCKOUT'} /> },
  { key: 'requiredQty', label: 'Required Qty', align: 'right', render: (row) => numberCell(row.requiredQty, row.reasonCode) },
  { key: 'moq', label: 'MOQ', align: 'right', render: (row) => numberCell(row.moq, row.reasonCode) },
  { key: 'packSize', label: 'Pack Size', align: 'right', render: (row) => numberCell(row.packSize, row.reasonCode) },
  { key: 'recommendedQty', label: 'Recommended Qty', align: 'right', render: (row) => numberCell(row.recommendedQty, row.reasonCode) },
  { key: 'recommendedOrderDate', label: 'Recommended Order Date', render: (row) => row.recommendedOrderDate ? <span>{row.recommendedOrderDate}{row.immediateOrder && ' · 즉시'}</span> : <EmptyValue reason={row.reasonCode ?? 'NO_ORDER_DATE'} /> },
];

export default function PurchaseRecommendationTable({ rows, error }: { rows: PurchaseRecommendation[]; error: string | null }) {
  return <DataTable columns={columns} rows={rows} error={error} rowKey={(row) => row.itemId} empty="발주 추천 데이터가 없습니다. STEP 7/9 결과와 policy 설정을 확인하세요." />;
}
