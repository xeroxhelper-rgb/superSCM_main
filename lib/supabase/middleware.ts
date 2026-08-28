import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { requireSupabaseEnv } from './env';
import { decideRouteAccess, normalizeRole } from '@/lib/auth-policy';

type CookieUpdate = { name: string; value: string; options: Record<string, unknown> };

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function updateSupabaseSession(request: NextRequest) {
  const { url, publishableKey } = requireSupabaseEnv();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: CookieUpdate[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  let role = null;
  let active = false;
  if (user) {
    const { data: profile } = await supabase.schema('core').from('app_user').select('role, active').eq('user_id', user.id).maybeSingle();
    role = normalizeRole(profile?.role);
    active = profile?.active === true;
  }
  const decision = decideRouteAccess({ pathname: request.nextUrl.pathname, search: request.nextUrl.search, authenticated: Boolean(user), role, active });
  if (decision.kind === 'redirect') {
    const redirect = NextResponse.redirect(new URL(decision.location, request.url));
    return copyCookies(response, redirect);
  }
  if (decision.kind === 'forbidden') return copyCookies(response, new NextResponse('접근 권한이 없습니다.', { status: 403 }));
  return response;
}
