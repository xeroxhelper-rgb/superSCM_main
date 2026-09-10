'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { defaultPathForRole, normalizeCredentials, normalizeProfile, safeNextPath } from '@/lib/auth-policy';

export type LoginState = { error: string | null };
export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const credentials = normalizeCredentials({ email: formData.get('email'), password: formData.get('password') });
  const next = safeNextPath(formData.get('next'));
  if (!credentials) return { error: '이메일 또는 비밀번호를 입력해주세요.' };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error || !data.user) {
    console.error('[로그인] Supabase 인증 실패', {
      code: error?.code ?? null,
      message: error?.message ?? null,
    });
    return { error: '이메일 또는 비밀번호를 확인해주세요.' };
  }
  const { data: row, error: profileError } = await supabase.schema('core').from('app_user').select('user_id, email, name, department, role, active, last_login_at').eq('user_id', data.user.id).maybeSingle();
  if (profileError) {
    console.error('[로그인] app_user 프로필 조회 실패', {
      code: profileError.code ?? null,
      message: profileError.message ?? null,
      details: profileError.details ?? null,
      hint: profileError.hint ?? null,
    });
    return { error: '사용자 정보를 확인하지 못했습니다.' };
  }
  const profile = normalizeProfile(row);
  if (!profile || !profile.active) { await supabase.auth.signOut(); return { error: '비활성화된 계정입니다.' }; }
  const { error: loginError } = await supabase.schema('core').rpc('touch_last_login');
  if (loginError) {
    console.error('[로그인] 마지막 로그인 시각 저장 실패', {
      code: loginError.code ?? null,
      message: loginError.message ?? null,
      details: loginError.details ?? null,
      hint: loginError.hint ?? null,
    });
    return { error: '로그인 기록을 저장하지 못했습니다.' };
  }
  redirect(next ?? defaultPathForRole(profile.role));
}
