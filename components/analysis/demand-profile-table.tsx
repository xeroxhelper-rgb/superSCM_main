'use client';

import { useMemo, useState } from 'react';
import Badge, { type StatusTone } from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { DemandProfile } from '@/lib/scm-model';
import DemandProfileFilters, { filterDemandProfiles, type DemandProfileFilter } from './demand-profile-filters';

function numberCell(value: number | null, percent = false) {
  if (value === null) return <EmptyValue reason="CALCULATION_UNAVAILABLE" />;
  return <span>{percent ? `${(value * 100).toFixed(1)}%` : value.toFixed(2)}</span>;
}

function demandTone(value: DemandProfile['demandType']): StatusTone {
  if (value === 'SMOOTH') return 'safe';
  if (value === 'INTERMITTENT') return 'info';
  if (value === 'ERRATIC') return 'warning';
  if (value === 'LUMPY') return 'critical';
  return 'calculation_unavailable';
}

export default function DemandProfileTable({ rows }: { rows: DemandProfile[] }) {
  const [filter, setFilter] = useState<DemandProfileFilter>({ demandType: 'ALL', calculation: 'ALL', search: '' });
  const filteredRows = useMemo(() => filterDemandProfiles(rows, filter), [rows, filter]);
  const columns: UiColumn<DemandProfile>[] = [
    { key: 'itemId', label: 'SKU' },
    { key: 'itemName', label: '품목명' },
    { key: 'adi', label: 'ADI', align: 'right', render: (row) => numberCell(row.adi) },
    { key: 'cvSquared', label: 'CV²', align: 'right', render: (row) => numberCell(row.cvSquared) },
    { key: 'zeroDemandRate', label: 'Zero-demand Rate', align: 'right', render: (row) => numberCell(row.zeroDemandRate, true) },
    { key: 'trend', label: 'Trend', align: 'right', render: (row) => numberCell(row.trend) },
    { key: 'demandType', label: 'Demand Type', render: (row) => row.demandType ? <Badge status={demandTone(row.demandType)}>{row.demandType}</Badge> : <EmptyValue reason={row.reasonCode} /> },
    { key: 'seasonality', label: 'Seasonality', render: (row) => row.seasonality === null ? <EmptyValue reason={row.reasonCode} /> : <span>{row.seasonality ? 'TRUE' : 'FALSE'}</span> },
    { key: 'reasonCode', label: 'Reason', render: (row) => row.reasonCode ? <span className="muted">{row.reasonCode}</span> : <span>—</span> },
  ];

  return <>
    <DemandProfileFilters value={filter} onChange={setFilter} />
    <DataTable columns={columns} rows={filteredRows} rowKey={(row) => row.itemId} empty="조건에 맞는 수요 프로파일이 없습니다." />
  </>;
}
