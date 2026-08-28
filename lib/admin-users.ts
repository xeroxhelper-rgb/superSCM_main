import { assertAllowedAdminChange, normalizeRole, type AppRole, type AppUserProfile } from './auth-policy.ts';

export class AdminUserError extends Error {}
type RoleInput = { actorId: string; targetId: string; role: unknown };
type ActiveInput = { actorId: string; targetId: string; active: boolean };
export async function setUserRole(input: RoleInput, mutate: () => Promise<void>) {
  assertAllowedAdminChange({ actorId: input.actorId, targetId: input.targetId, nextRole: input.role });
  if (!normalizeRole(input.role)) throw new AdminUserError('허용되지 않는 역할입니다.');
  await mutate();
}
export async function setUserActive(input: ActiveInput, mutate: () => Promise<void>) {
  assertAllowedAdminChange({ actorId: input.actorId, targetId: input.targetId, nextActive: input.active });
  await mutate();
}
export async function listAppUsers(): Promise<{ data: AppUserProfile[]; error: string | null }> {
  const { createSupabaseServerClient } = await import('./supabase/server.ts');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').from('app_user').select('user_id, email, name, department, role, active, last_login_at').order('name');
  if (error) return { data: [], error: '사용자 목록을 조회하지 못했습니다.' };
  return { data: (data ?? []).map((row) => ({ userId: row.user_id, email: row.email, name: row.name, department: row.department ?? null, role: row.role as AppRole, active: row.active, lastLoginAt: row.last_login_at ?? null })), error: null };
}
export async function changeRoleWithRpc(actorId: string, targetId: string, role: AppRole) {
  const { createSupabaseServerClient } = await import('./supabase/server.ts');
  const supabase = await createSupabaseServerClient();
  const result = await setUserRole({ actorId, targetId, role }, async () => { const { error } = await supabase.schema('core').rpc('admin_set_user_role', { target_user_id: targetId, next_role: role }); if (error) throw new AdminUserError('역할을 변경하지 못했습니다.'); });
  return result;
}
export async function changeActiveWithRpc(actorId: string, targetId: string, active: boolean) {
  const { createSupabaseServerClient } = await import('./supabase/server.ts');
  const supabase = await createSupabaseServerClient();
  return setUserActive({ actorId, targetId, active }, async () => { const { error } = await supabase.schema('core').rpc('admin_set_user_active', { target_user_id: targetId, next_active: active }); if (error) throw new AdminUserError('계정 상태를 변경하지 못했습니다.'); });
}
