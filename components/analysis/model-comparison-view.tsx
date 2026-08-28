'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import ForecastOverlayChart from '@/components/chart/forecast-overlay-chart';
import type { ComparisonPoint } from '@/lib/scm-model';

const number = (value: number | null, suffix = '') => value === null ? <EmptyValue /> : `${value.toFixed(1)}${suffix}`;

export default function ModelComparisonView({ points, error }: { points: ComparisonPoint[]; error: string | null }) {
  const [item, setItem] = useState(''); const [run, setRun] = useState(''); const [model, setModel] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[] | null>(null);
  const items = Array.from(new Set(points.map((point) => point.itemId))).sort(); const runs = Array.from(new Set(points.map((point) => point.runId))).sort(); const models = Array.from(new Set(points.map((point) => point.modelId))).sort();
  const filtered = useMemo(() => points.filter((point) => (!item || point.itemId === item) && (!run || point.runId === run) && (!model || point.modelId === model) && (!from || point.period >= from) && (!to || point.period <= to)), [points, item, run, model, from, to]);
  const modelIds = selectedModels ?? models;
  const chartPoints = item ? filtered : filtered.filter((point) => point.itemId === filtered[0]?.itemId);
  const rows = Array.from(new Map(filtered.map((point) => [`${point.itemId}-${point.modelId}`, point])).values());
  const columns: UiColumn<ComparisonPoint>[] = [
    { key: 'modelName', label: 'Model Name' }, { key: 'wape', label: 'WAPE', align: 'right', render: (row) => number(row.wape, '%') }, { key: 'mape', label: 'MAPE', align: 'right', render: (row) => number(row.mape, '%') }, { key: 'bias', label: 'Bias', align: 'right', render: (row) => number(row.bias, '%') }, { key: 'rmse', label: 'RMSE', align: 'right', render: (row) => number(row.rmse) }, { key: 'mae', label: 'MAE', align: 'right', render: (row) => number(row.mae) }, { key: 'rank', label: 'Rank', align: 'right', render: (row) => row.rank === null ? <EmptyValue /> : row.rank }, { key: 'is_champion', label: 'Champion', render: (row) => row.isChampion ? <Badge status="safe">CHAMPION</Badge> : <span className="muted-ui">—</span> },
  ];
  const downloadCsv = () => { const header = ['item_id', 'model_id', 'period', 'actual_qty', 'predicted_qty', 'wape', 'mape', 'bias', 'rmse', 'mae', 'rank']; const body = rows.map((row) => [row.itemId, row.modelId, row.period, row.actualQty, row.predictedQty, row.wape, row.mape, row.bias, row.rmse, row.mae, row.rank].join(',')); const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'model-performance.csv'; link.click(); URL.revokeObjectURL(url); };
  return <>
    <div className="comparison-filters"><label>SKU<select value={item} onChange={(event) => setItem(event.target.value)}><option value="">전체</option>{items.map((value) => <option key={value}>{value}</option>)}</select></label><label>Forecast Run<select value={run} onChange={(event) => setRun(event.target.value)}><option value="">전체</option>{runs.map((value) => <option key={value}>{value}</option>)}</select></label><label>Model<select value={model} onChange={(event) => setModel(event.target.value)}><option value="">전체</option>{models.map((value) => <option key={value}>{value}</option>)}</select></label><label>기간 시작<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>기간 종료<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
    <div className="model-toggle-list"><strong>차트 모델</strong>{models.map((modelId) => <label key={modelId}><input type="checkbox" checked={modelIds.includes(modelId)} onChange={() => setSelectedModels((current) => { const base = current ?? models; return base.includes(modelId) ? base.filter((id) => id !== modelId) : [...base, modelId]; })} /> {modelId}</label>)}<button className="button-ui" type="button" onClick={downloadCsv}>CSV 내보내기</button></div>
    {error ? <p className="empty-state-ui"><strong>조회에 실패했습니다.</strong><br />{error}</p> : <><ForecastOverlayChart points={chartPoints} modelIds={modelIds} /><DataTable columns={columns} rows={rows} rowKey={(row) => `${row.itemId}-${row.modelId}-${row.period}`} empty="Model Performance가 없습니다." /></>}
  </>;
}
