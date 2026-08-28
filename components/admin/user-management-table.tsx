import Badge from '@/components/ui/badge';
import DataTable from '@/components/ui/data-table';
import type { AppUserProfile } from '@/lib/auth-policy';
import { changeUserActiveAction, changeUserRoleAction } from '@/app/(admin)/admin/users/actions';

export default function UserManagementTable({ users, actorId }: { users: AppUserProfile[]; actorId: string }) {
  return <DataTable rows={users} rowKey={(row) => row.userId} columns={[
    { key: 'name', label: '이름' }, { key: 'email', label: '이메일' }, { key: 'department', label: '부서' },
    { key: 'role', label: '역할', render: (row) => <form action={changeUserRoleAction} className="admin-control"><input type="hidden" name="target_id" value={row.userId} /><select name="role" defaultValue={row.role} disabled={row.userId === actorId} onChange={(event) => event.currentTarget.form?.requestSubmit()}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select>{row.userId === actorId ? <small>내 관리자 권한 유지</small> : null}</form> },
    { key: 'active', label: '상태', render: (row) => <form action={changeUserActiveAction} className="admin-control"><input type="hidden" name="target_id" value={row.userId} /><input type="hidden" name="active" value={String(!row.active)} /><button className="button-ui" type="submit" disabled={row.userId === actorId && row.active}>{row.active ? <Badge status="safe">ACTIVE</Badge> : <Badge status="calculation_unavailable">INACTIVE</Badge>}</button>{row.userId === actorId ? <small>내 계정은 비활성화 불가</small> : null}</form> },
    { key: 'last_login_at', label: '마지막 로그인', render: (row) => row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('ko-KR') : '—' },
  ]} empty="등록된 사용자가 없습니다." />;
}
