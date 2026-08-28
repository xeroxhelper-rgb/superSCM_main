import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeProfile, type AppUserProfile } from '@/lib/auth-policy';

export class AuthorizationError extends Error {
  status = 403 as const;
}

async function loadProfile(): Promise<AppUserProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) return null;
  const { data, error } = await supabase.schema('core').from('app_user').select('user_id, email, name, department, role, active, last_login_at').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return normalizeProfile(data);
}

export async function requireUser(): Promise<AppUserProfile> {
  const profile = await loadProfile();
  if (!profile) redirect('/login');
  if (!profile.active) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect('/login?error=inactive');
  }
  return profile;
}

export async function requireAdmin(): Promise<AppUserProfile> {
  const profile = await requireUser();
  if (profile.role !== 'ADMIN') throw new AuthorizationError('관리자 권한이 필요합니다.');
  return profile;
}

export async function getRole() {
  const profile = await loadProfile();
  return profile?.active ? profile.role : null;
}
