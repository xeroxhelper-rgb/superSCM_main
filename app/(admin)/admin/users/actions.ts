'use server';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { changeActiveWithRpc, changeRoleWithRpc } from '@/lib/admin-users';
import { normalizeRole, safeNextPath } from '@/lib/auth-policy';

export async function changeUserRoleAction(formData: FormData) {
  const actor = await requireAdmin();
  const targetId = String(formData.get('target_id') ?? '');
  const role = normalizeRole(formData.get('role'));
  if (!targetId || !role) redirect('/admin/users?error=invalid');
  try { await changeRoleWithRpc(actor.userId, targetId, role); } catch { redirect('/admin/users?error=role'); }
  redirect('/admin/users?success=role');
}
export async function changeUserActiveAction(formData: FormData) {
  const actor = await requireAdmin();
  const targetId = String(formData.get('target_id') ?? '');
  const active = formData.get('active') === 'true';
  if (!targetId) redirect('/admin/users?error=invalid');
  try { await changeActiveWithRpc(actor.userId, targetId, active); } catch { redirect('/admin/users?error=active'); }
  redirect('/admin/users?success=active');
}
