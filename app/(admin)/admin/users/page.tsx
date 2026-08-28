import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import UserManagementTable from '@/components/admin/user-management-table';
import { requireAdmin } from '@/lib/auth';
import { listAppUsers } from '@/lib/admin-users';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const actor = await requireAdmin();
  const result = await listAppUsers();
  const params = await searchParams;
  const notice = params.error ? '변경을 처리하지 못했습니다.' : params.success ? '변경했습니다.' : null;
  return <><PageHeader eyebrow="ADMIN / USERS" title="사용자 관리" description="계정 활성 상태와 역할을 관리합니다." /><Panel title="등록 사용자" meta={notice ? <span className="admin-notice">{notice}</span> : null}><UserManagementTable users={result.data} actorId={actor.userId} /></Panel>{result.error ? <p className="empty-state-ui"><strong>조회에 실패했습니다.</strong><br />{result.error}</p> : null}</>;
}
