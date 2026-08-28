import Link from 'next/link';
import Badge from '@/components/ui/badge';

export default function Topbar({ eyebrow = 'MONTHLY PROCUREMENT CONTROL', title }: { eyebrow?: string; title: string }) {
  return (
    <header className="design-topbar">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <strong>{title}</strong>
      </div>
      <div className="design-topbar-meta">
        <Badge status="safe">SUPABASE LIVE</Badge>
        <span>기준월도 <b>2026.09</b></span>
        <Link className="button-ui" href="/login">로그인</Link>
      </div>
    </header>
  );
}
