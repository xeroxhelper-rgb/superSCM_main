'use client';

import Badge from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import type { ForecastModel } from '@/lib/scm-model';
import { updateForecastModelAction } from '@/app/(admin)/admin/forecast-models/actions';

const columns: UiColumn<ForecastModel>[] = [
  { key: 'modelName', label: '모델명' }, { key: 'family', label: 'Family' }, { key: 'engine', label: 'Engine' }, { key: 'version', label: 'Version' },
  { key: 'enabled', label: 'Enabled', render: (row) => <Badge status={row.enabled ? 'safe' : 'calculation_unavailable'}>{row.enabled ? 'ON' : 'OFF'}</Badge> },
  { key: 'applicableDemandType', label: 'Applicable Demand Type', render: (row) => row.applicableDemandType.join(', ') || <EmptyValue reason="NO_APPLICABLE_TYPE" /> },
  { key: 'parameters', label: 'Parameters', render: (row) => <code>{JSON.stringify(row.parameters)}</code> },
  { key: 'actions', label: '변경', render: (row) => <form action={updateForecastModelAction} className="admin-control"><input type="hidden" name="model_id" value={row.modelId} /><input type="hidden" name="enabled" value={String(!row.enabled)} /><input type="hidden" name="parameters" value={JSON.stringify(row.parameters)} /><button className="button-ui" type="submit">{row.enabled ? '비활성화' : '활성화'}</button></form> },
];

export default function ForecastModelsTable({ rows, error }: { rows: ForecastModel[]; error?: string | null }) {
  return <DataTable columns={columns} rows={rows} error={error} rowKey={(row) => row.modelId} empty="등록된 Forecast 모델이 없습니다." />;
}
