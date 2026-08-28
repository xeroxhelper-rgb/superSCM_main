'use client';

import type { ComparisonPoint } from '@/lib/scm-model';

export default function ForecastOverlayChart({ points, modelIds }: { points: ComparisonPoint[]; modelIds: string[] }) {
  const periods = Array.from(new Set(points.map((point) => point.period))).sort();
  if (!periods.length) return <div className="chart-empty">비교할 시계열이 없습니다.</div>;
  const values = points.flatMap((point) => [point.actualQty, ...modelIds.map((id) => point.modelId === id ? point.predictedQty : null)]).filter((value): value is number => value !== null);
  const max = Math.max(...values, 1);
  const x = (period: string) => periods.length === 1 ? 50 : (periods.indexOf(period) / (periods.length - 1)) * 100;
  const y = (value: number | null) => value === null ? null : 92 - (value / max) * 82;
  const line = (modelId: string | null) => periods.map((period) => { const point = points.find((row) => row.period === period && (modelId === null ? true : row.modelId === modelId)); const value = modelId === null ? point?.actualQty ?? null : point?.predictedQty ?? null; const yy = y(value); return yy === null ? '' : `${x(period)},${yy}`; }).filter(Boolean).join(' ');
  const interval = points.find((point) => modelIds.includes(point.modelId) && point.p90 !== null && point.p50 !== null);
  const intervalPoints = interval ? periods.map((period) => points.find((point) => point.period === period && point.modelId === interval.modelId)).filter((point): point is ComparisonPoint => Boolean(point && point.p90 !== null && point.p50 !== null)) : [];
  const intervalPolygon = intervalPoints.length > 1 ? [...intervalPoints.map((point) => `${x(point.period)},${y(point.p90)}`), ...intervalPoints.slice().reverse().map((point) => `${x(point.period)},${y(point.p50)}`)].join(' ') : '';
  return <div className="chart-panel forecast-overlay-chart" aria-label="Actual과 모델별 Forecast 비교 차트">
    <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
      <rect className="validation-band" x="0" y="0" width="100" height="100" />
      {line(null) && <polyline className="forecast-chart-line actual" points={line(null)} fill="none" />}
      {intervalPolygon && <polygon className="forecast-interval" points={intervalPolygon} />}
      {modelIds.map((modelId, index) => line(modelId) && <polyline key={modelId} className={`forecast-chart-line model-${index % 4}`} points={line(modelId)} fill="none" />)}
    </svg>
    <div className="chart-legend"><span><i className="legend-dot actual" /> Actual</span>{modelIds.map((modelId, index) => <span key={modelId}><i className={`legend-dot model-${index % 4}`} /> {modelId}</span>)}</div>
    <div className="chart-axis-labels">{periods.map((period) => <span key={period}>{period.slice(0, 7)}</span>)}</div>
  </div>;
}
