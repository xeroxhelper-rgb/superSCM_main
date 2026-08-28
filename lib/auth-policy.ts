export type AppRole = 'ADMIN' | 'USER';

export type AppUserProfile = {
  userId: string;
  email: string;
  name: string;
  department: string | null;
  role: AppRole;
  active: boolean;
  lastLoginAt: string | null;
};

export type RouteAccessInput = {
  pathname: string;
  search: string;
  authenticated: boolean;
  role: AppRole | null;
  active: boolean;
};

export type RouteAccessDecision =
  | { kind: 'allow' }
  | { kind: 'forbidden' }
  | { kind: 'redirect'; location: string };

export type AdminChange = {
  actorId: string;
  targetId: string;
  nextRole?: unknown;
  nextActive?: boolean;
};

export function normalizeRole(value: unknown): AppRole | null {
  return value === 'ADMIN' || value === 'USER' ? value : null;
}

export function safeNextPath(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) return null;
  if (/^\/login(?:[/?#]|$)/.test(value)) return null;
  return value;
}

export function defaultPathForRole(role: AppRole): '/admin' | '/' {
  return role === 'ADMIN' ? '/admin' : '/';
}

export function decideRouteAccess(input: RouteAccessInput): RouteAccessDecision {
  const protectedPath =
    input.pathname === '/' ||
    ['/analysis', '/workflow', '/admin'].some(
      (prefix) => input.pathname === prefix || input.pathname.startsWith(`${prefix}/`),
    );

  if (!protectedPath) return { kind: 'allow' };

  if (!input.authenticated || !input.active || input.role === null) {
    const nextPath = safeNextPath(`${input.pathname}${input.search}`) ?? '/';
    return { kind: 'redirect', location: `/login?next=${encodeURIComponent(nextPath)}` };
  }

  if (input.pathname === '/admin' || input.pathname.startsWith('/admin/')) {
    return input.role === 'ADMIN' ? { kind: 'allow' } : { kind: 'forbidden' };
  }

  return { kind: 'allow' };
}

export function assertAllowedAdminChange(change: AdminChange): void {
  if (change.nextRole !== undefined && normalizeRole(change.nextRole) === null) {
    throw new Error('허용되지 않는 역할입니다.');
  }

  if (change.actorId !== change.targetId) return;

  if (change.nextRole !== undefined && change.nextRole !== 'ADMIN') {
    throw new Error('자신의 관리자 권한을 제거할 수 없습니다.');
  }

  if (change.nextActive === false) {
    throw new Error('자신의 계정을 비활성화할 수 없습니다.');
  }
}
