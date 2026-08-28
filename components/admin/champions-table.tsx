import Badge from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { ChampionModel } from '@/lib/scm-model';
import { setManualChampionAction } from '@/app/(admin)/admin/champions/actions';

export default function ChampionsTable({ rows, error }: { rows: ChampionModel[]; error: string | null }) {
  const columns: UiColumn<ChampionModel>[] = [{ key: 'itemId', label: 'SKU' }, { key: 'championModelId', label: 'Champion Model' }, { key: 'championMetric', label: 'Metric' }, { key: 'championMetricValue', label: 'Metric Value', render: (row) => row.championMetricValue === null ? <EmptyValue reason="METRIC_UNAVAILABLE" /> : `${row.championMetricValue.toFixed(1)}%` }, { key: 'selectionMethod', label: '선정 방식', render: (row) => <Badge status={row.selectionMethod === 'MANUAL' ? 'info' : 'safe'}>{row.selectionMethod}</Badge> }, { key: 'selectionReason', label: '선정 사유', render: (row) => row.selectionReason ?? <EmptyValue reason="NO_REASON" /> }, { key: 'actions', label: '수동 변경', render: (row) => <form action={setManualChampionAction} className="admin-control"><input type="hidden" name="item_id" value={row.itemId} /><input type="hidden" name="model_id" value={row.championModelId} /><input type="hidden" name="backtest_run_id" value={row.backtestRunId ?? ''} /><input name="reason" required placeholder="변경 사유 필수" aria-label={`${row.itemId} 변경 사유`} /><button className="button-ui" type="submit">현재 모델 기록</button></form> }];
  return <DataTable columns={columns} rows={rows} error={error} rowKey={(row) => row.championId} empty="Champion 기록이 없습니다." />;
}
