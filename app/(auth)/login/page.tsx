import Link from 'next/link';
import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Button from '@/components/ui/button';

export default function LoginPage() {
  return <Panel className="auth-panel"><PageHeader eyebrow="ACCESS" title="로그인 준비 중" description="인증 기능은 다음 단계에서 연결됩니다." /><Button variant="primary" href="/">발주계획으로 돌아가기</Button><p className="muted-ui"><Link href="/admin">관리자 화면 보기</Link></p></Panel>;
}
