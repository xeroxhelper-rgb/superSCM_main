import Badge from '@/components/ui/badge';
import { logoutAction } from '@/app/(auth)/logout/actions';
import type { AppUserProfile } from '@/lib/auth-policy';

export default function Topbar({ eyebrow = 'MONTHLY PROCUREMENT CONTROL', title, profile }: { eyebrow?: string; title: string; profile: AppUserProfile }) {
  return (
    <header className="design-topbar">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <strong>{title}</strong>
      </div>
      <div className="design-topbar-meta">
        <Badge status="safe">SUPABASE LIVE</Badge>
        <span>기준월도 <b>2026.09</b></span>
        <span className="topbar-user">{profile.name} <Badge status="info">{profile.role}</Badge></span>
        <form action={logoutAction}><button className="button-ui" type="submit">로그아웃</button></form>
      </div>
    </header>
  );
}
