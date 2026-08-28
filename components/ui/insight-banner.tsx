import type { ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';

export default function InsightBanner({ title, children }: { title: string; children: ReactNode }) {
  return <div className="insight-banner"><Lightbulb size={17} aria-hidden="true" /><div className="insight-banner-copy"><strong>{title}</strong><p>{children}</p></div></div>;
}
