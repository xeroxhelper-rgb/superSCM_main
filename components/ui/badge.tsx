import type { ReactNode } from 'react';

export type StatusTone = 'safe' | 'warning' | 'critical' | 'calculation_unavailable' | 'info';

const labels: Record<StatusTone, string> = {
  safe: 'SAFE',
  warning: 'WARNING',
  critical: 'CRITICAL',
  calculation_unavailable: 'CALCULATION UNAVAILABLE',
  info: 'INFO',
};

export default function Badge({ status, children }: { status: StatusTone; children?: ReactNode }) {
  return <span className={`badge badge-${status}`}>{children ?? labels[status]}</span>;
}
