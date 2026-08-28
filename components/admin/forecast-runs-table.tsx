import Badge from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { ForecastRun } from '@/lib/scm-model';

function statusTone(status: ForecastRun['status']) { return status === 'SUCCESS' ? 'safe' : status === 'FAILED' ? 'critical' : 'warning'; }
const columns: UiColumn<ForecastRun>[] = [
  { key: 'runId', label: 'Run ID' }, { key: 'status', label: '상태', render: (row) => <Badge status={statusTone(row.status)}>{row.status}</Badge> },
  { key: 'startedAt', label: '실행시간', render: (row) => row.startedAt ? <time dateTime={row.startedAt}>{row.startedAt}</time> : <EmptyValue reason="NO_START_TIME" /> },
  { key: 'nModels', label: '모델 수', align: 'right' }, { key: 'nItems', label: 'SKU 수', align: 'right' }, { key: 'nRows', label: '결과 행 수', align: 'right' },
  { key: 'dataSnapshotAt', label: 'Data Snapshot', render: (row) => row.dataSnapshotAt ? <time dateTime={row.dataSnapshotAt}>{row.dataSnapshotAt}</time> : <EmptyValue reason="SNAPSHOT_UNAVAILABLE" /> },
  { key: 'isStale', label: 'Stale', render: (row) => row.isStale === null ? <EmptyValue reason={row.staleReason} /> : row.isStale ? <Badge status="warning">STALE</Badge> : <Badge status="safe">CURRENT</Badge> },
  { key: 'triggeredEmail', label: '실행자', render: (row) => row.triggeredEmail ?? <EmptyValue reason="NO_ACTOR" /> },
];

export default function ForecastRunsTable({ rows, error }: { rows: ForecastRun[]; error?: string | null }) { return <DataTable columns={columns} rows={rows} error={error} rowKey={(row) => row.runId} empty="Forecast 실행 이력이 없습니다." />; }
