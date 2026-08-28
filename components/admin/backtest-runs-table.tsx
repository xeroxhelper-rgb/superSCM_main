import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { BacktestRun, ForecastRun } from '@/lib/scm-model';
import { runBacktestAction } from '@/app/(admin)/admin/backtest-runs/actions';

function tone(status: BacktestRun['status']) { return status === 'SUCCESS' ? 'safe' : status === 'FAILED' ? 'critical' : 'warning'; }
export default function BacktestRunsTable({ rows, forecastRuns, error }: { rows: BacktestRun[]; forecastRuns: ForecastRun[]; error: string | null }) {
  const columns: UiColumn<BacktestRun>[] = [{ key: 'backtestRunId', label: 'Backtest Run ID' }, { key: 'forecastRunId', label: 'Forecast Run ID' }, { key: 'metric', label: 'Champion Metric' }, { key: 'status', label: '상태', render: (row) => <Badge status={tone(row.status)}>{row.status}</Badge> }, { key: 'testStart', label: '검증 시작', render: (row) => row.testStart ?? <EmptyValue reason="TEST_PERIOD_UNAVAILABLE" /> }, { key: 'testEnd', label: '검증 종료', render: (row) => row.testEnd ?? <EmptyValue reason="TEST_PERIOD_UNAVAILABLE" /> }, { key: 'startedAt', label: '실행 시각', render: (row) => row.startedAt ?? <EmptyValue reason="NO_START_TIME" /> }];
  return <><div className="admin-control backtest-run-controls">{forecastRuns.filter((run) => run.status === 'SUCCESS').map((run) => <form action={runBacktestAction} key={run.runId}><input type="hidden" name="forecast_run_id" value={run.runId} /><Button type="submit" variant="primary">{run.runId.slice(0, 8)} Backtest 실행</Button></form>)}</div><DataTable columns={columns} rows={rows} error={error} rowKey={(row) => row.backtestRunId} empty="Backtest 실행 이력이 없습니다." /></>;
}
