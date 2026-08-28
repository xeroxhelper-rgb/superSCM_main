import type { ReactNode } from 'react';
import Badge, { type StatusTone } from './badge';

export default function KpiCard({ label, value, foot, status }: { label: string; value: ReactNode; foot?: ReactNode; status?: StatusTone }) {
  return <section className="kpi-card"><div className="kpi-card-label"><span>{label}</span>{status && <Badge status={status} />}</div><div className="kpi-card-value">{value}</div>{foot && <div className="kpi-card-foot">{foot}</div>}</section>;
}
