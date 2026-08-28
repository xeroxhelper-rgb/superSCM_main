import type { ReactNode } from 'react';
import { AlertTriangle, CircleCheck } from 'lucide-react';

export default function AlertRow({ tone = 'warning', title, children }: { tone?: 'warning' | 'critical'; title: string; children: ReactNode }) {
  const Icon = tone === 'critical' ? AlertTriangle : CircleCheck;
  return <div className={`alert-row alert-row-${tone}`}><Icon size={16} aria-hidden="true" /><div className="alert-row-copy"><strong>{title}</strong><p>{children}</p></div></div>;
}
