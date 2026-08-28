import type { ReactNode } from 'react';

export default function PageHeader({ eyebrow = 'SCM WORKSPACE', title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </header>
  );
}
