import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import LoginForm from '@/components/auth/login-form';
import { safeNextPath } from '@/lib/auth-policy';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <Panel className="auth-panel"><PageHeader eyebrow="ACCESS" title="월간 발주계획 로그인" description="등록된 계정으로 로그인해주세요." /><LoginForm next={safeNextPath(params.next) ?? '/'} /></Panel>;
}
