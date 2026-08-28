'use client';
import { useActionState } from 'react';
import Button from '@/components/ui/button';
import { loginAction, type LoginState } from '@/app/(auth)/login/actions';

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null });
  return <form className="auth-form" action={action}>
    <input type="hidden" name="next" value={next} />
    <label className="auth-field">이메일<input name="email" type="email" autoComplete="email" required /></label>
    <label className="auth-field">비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
    {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
    <Button variant="primary" type="submit" disabled={pending}>{pending ? '로그인 중...' : '로그인'}</Button>
  </form>;
}
