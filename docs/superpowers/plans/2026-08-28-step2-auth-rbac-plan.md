# STEP 2 인증·Role·RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase 세션과 `core.app_user`를 기준으로 ADMIN/USER 권한을 프론트엔드, Next.js 서버, PostgreSQL RLS/RPC 세 계층에서 강제한다.

**Architecture:** cookie 기반 `@supabase/ssr` client가 인증 세션을 유지하고, middleware와 server layout이 보호 경로를 이중 검증한다. 역할의 최종 근거는 `core.app_user`이며 관리자 mutation은 Server Action과 DB RPC 모두에서 ADMIN 및 자기 계정 보호를 검사하고 DB trigger가 audit를 기록한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase Auth/PostgreSQL, `@supabase/ssr`, Node test runner, 순수 CSS

**Spec:** `docs/superpowers/specs/2026-08-28-step2-auth-rbac-design.md`

## Global Constraints

- Tailwind, styled-components, CSS Modules를 추가하지 않는다.
- role은 화면 입력이나 JWT user metadata를 신뢰하지 않고 `core.app_user`에서 조회한다.
- service role key/client를 브라우저 또는 공용 server client에 추가하지 않는다.
- anon의 업무 데이터 접근과 write를 차단한다.
- 관리자 mutation은 Server Action 첫 단계와 DB RPC 양쪽에서 권한을 검사한다.
- 기존 SCM 계산 SQL과 `raw` 데이터는 변경하지 않는다.
- 화면 문구, 주석, 커밋 메시지는 한국어로 작성한다.
- 계산 불가 값을 숫자로 변환하지 않는다.

---

### Task 1: 순수 인증·인가 정책

**Files:**
- Create: `lib/auth-policy.test.ts`
- Create: `lib/auth-policy.ts`

**Interfaces:**
- Produces: `AppRole`, `AppUserProfile`, `normalizeRole()`, `safeNextPath()`, `defaultPathForRole()`, `decideRouteAccess()`, `assertAllowedAdminChange()`.
- Consumes: 없음.

- [ ] **Step 1: redirect와 role 정규화 실패 테스트 작성**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRole,
  safeNextPath,
  defaultPathForRole,
  decideRouteAccess,
  assertAllowedAdminChange,
} from './auth-policy.ts';

test('외부 URL과 로그인 순환 경로를 next로 허용하지 않는다', () => {
  assert.equal(safeNextPath('https://evil.example'), null);
  assert.equal(safeNextPath('//evil.example'), null);
  assert.equal(safeNextPath('/login?next=/admin'), null);
  assert.equal(safeNextPath('/analysis/leadtime?month=2026-09'), '/analysis/leadtime?month=2026-09');
});

test('DB 역할만 ADMIN 또는 USER로 정규화한다', () => {
  assert.equal(normalizeRole('ADMIN'), 'ADMIN');
  assert.equal(normalizeRole('USER'), 'USER');
  assert.equal(normalizeRole('admin'), null);
  assert.equal(normalizeRole(undefined), null);
  assert.equal(defaultPathForRole('ADMIN'), '/admin');
  assert.equal(defaultPathForRole('USER'), '/');
});
```

- [ ] **Step 2: 테스트를 실행해 export 부재로 실패 확인**

Run: `node --test lib/auth-policy.test.ts`

Expected: `Cannot find module './auth-policy.ts'` 또는 named export 부재로 FAIL.

- [ ] **Step 3: 최소 정책 타입과 함수 구현**

```ts
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

export function normalizeRole(value: unknown): AppRole | null {
  return value === 'ADMIN' || value === 'USER' ? value : null;
}

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value === '/login' || value.startsWith('/login?')) return null;
  return value;
}

export function defaultPathForRole(role: AppRole): '/admin' | '/' {
  return role === 'ADMIN' ? '/admin' : '/';
}
```

- [ ] **Step 4: route 접근과 자기 계정 보호 실패 테스트 추가**

```ts
test('미로그인은 원래 경로 로그인으로 보내고 USER의 admin 접근은 403 처리한다', () => {
  assert.deepEqual(
    decideRouteAccess({ pathname: '/analysis/leadtime', search: '?month=2026-09', authenticated: false, role: null, active: false }),
    { kind: 'redirect', location: '/login?next=%2Fanalysis%2Fleadtime%3Fmonth%3D2026-09' },
  );
  assert.deepEqual(
    decideRouteAccess({ pathname: '/admin/users', search: '', authenticated: true, role: 'USER', active: true }),
    { kind: 'forbidden' },
  );
  assert.deepEqual(
    decideRouteAccess({ pathname: '/admin/users', search: '', authenticated: true, role: 'ADMIN', active: true }),
    { kind: 'allow' },
  );
});

test('ADMIN은 자신의 권한 제거와 자기 비활성화를 할 수 없다', () => {
  assert.throws(() => assertAllowedAdminChange({ actorId: 'a', targetId: 'a', nextRole: 'USER' }), /자신의 관리자 권한/);
  assert.throws(() => assertAllowedAdminChange({ actorId: 'a', targetId: 'a', nextActive: false }), /자신의 계정/);
  assert.doesNotThrow(() => assertAllowedAdminChange({ actorId: 'a', targetId: 'b', nextRole: 'USER' }));
});
```

- [ ] **Step 5: route 결정과 관리자 변경 검증 구현**

`decideRouteAccess()`는 `/`, `/analysis`, `/workflow`, `/admin`만 보호하고 공개 경로는 allow한다. 비활성 또는 프로필 없는 세션은 미로그인과 동일하게 로그인 redirect하며 `/admin`은 ADMIN만 allow한다. `assertAllowedAdminChange()`는 허용 role 외 값을 거부하고 actor/target이 같을 때 `nextRole !== 'ADMIN'` 또는 `nextActive === false`를 거부한다.

- [ ] **Step 6: 정책 테스트 통과 확인**

Run: `node --test lib/auth-policy.test.ts`

Expected: 모든 auth-policy 테스트 PASS.

- [ ] **Step 7: 커밋**

```bash
git add lib/auth-policy.ts lib/auth-policy.test.ts
git commit -m "인증 권한 정책 모델 추가"
```

### Task 2: Supabase DB schema, RPC, RLS, audit

**Files:**
- Create: `supabase/migrations/20260828000100_step2_auth_rbac.sql`
- Create: `sql/03-step2-verify.sql`
- Modify: `sql/01-grants.sql`
- Modify: `sql/02-policies.sql`

**Interfaces:**
- Produces: `core.app_user`, `core.audit_log`, `core.is_admin()`, `core.touch_last_login()`, `core.admin_set_user_role(uuid,text)`, `core.admin_set_user_active(uuid,boolean)`.
- Consumes: Supabase `auth.users`, 기존 `core.leadtime_plan`, `core.usage_profile`, `analytics` views.

- [ ] **Step 1: migration에 테이블과 제약조건 작성**

```sql
create table if not exists core.app_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  department text,
  role text not null default 'USER' check (role in ('ADMIN', 'USER')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists core.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
```

- [ ] **Step 2: 신규 Auth 사용자 trigger와 기존 사용자 backfill 작성**

`core.handle_new_auth_user()`는 `security definer set search_path = ''`로 만들고 `new.raw_user_meta_data ->> 'name'`, `department`만 읽는다. role metadata는 읽지 않고 role을 항상 `USER`로 INSERT한다. `auth.users`의 `on_auth_user_created` AFTER INSERT trigger를 연결하고 기존 `auth.users`는 `on conflict (user_id) do nothing`으로 backfill한다.

- [ ] **Step 3: DB 권한 함수와 관리자 RPC 작성**

`core.is_admin()`은 active ADMIN 존재 여부만 반환한다. 두 관리자 RPC는 `auth.uid() is null` 또는 `not core.is_admin()`이면 `42501`을 raise하고, 자신의 강등/비활성화를 `42501`로 거부하며 대상 미존재는 `P0002`로 거부한다. role RPC는 `next_role in ('ADMIN','USER')`를 검증한다. 모든 함수는 `security definer set search_path = ''`를 사용한다.

- [ ] **Step 4: updated_at 및 audit trigger 작성**

app_user BEFORE UPDATE trigger는 `updated_at = now()`를 설정한다. AFTER UPDATE trigger는 role 변화와 active 변화를 각각 독립 audit 행으로 기록하며 actor는 `auth.uid()`, target_type은 `APP_USER`, target_id는 `new.user_id::text`를 사용한다.

- [ ] **Step 5: 기존 위험 grant와 policy 제거 및 안전 RLS 작성**

```sql
revoke all on schema core, analytics from anon;
revoke all privileges on all tables in schema core from anon;
revoke all privileges on all tables in schema analytics from anon;
revoke insert, update, delete on all tables in schema public from anon;

drop policy if exists "수업용 전체 허용" on core.leadtime_plan;
drop policy if exists "수업용 전체 허용" on core.usage_profile;

alter table core.app_user enable row level security;
alter table core.audit_log enable row level security;

create policy app_user_read_self_or_admin on core.app_user
  for select to authenticated
  using (user_id = (select auth.uid()) or core.is_admin());

create policy audit_log_read_admin on core.audit_log
  for select to authenticated
  using (core.is_admin());
```

`leadtime_plan`과 `usage_profile`에는 active authenticated SELECT 정책과 `core.is_admin()` 기반 INSERT/UPDATE/DELETE 정책을 추가한다. direct app_user UPDATE와 audit INSERT 권한은 부여하지 않고 관리자 RPC만 허용한다. 기존 `public` 업무 테이블 6개는 RLS를 활성화하고 anon DML을 revoke한다.

- [ ] **Step 6: SQL helper 파일을 안전한 정책으로 동기화**

`sql/01-grants.sql`은 anon grant를 모두 제거하고 authenticated의 schema usage와 analytics/core SELECT만 부여한다. `sql/02-policies.sql`은 `using(true)` 정책을 삭제하고 ADMIN 정책만 정의한다. 파일 주석에 migration이 canonical임을 명시한다.

- [ ] **Step 7: read-only 검증 SQL 작성**

`sql/03-step2-verify.sql`은 `has_schema_privilege`, `has_table_privilege`, `pg_policies`, `information_schema.routines`, trigger catalog를 조회해 anon write=false, 위험 정책 0건, 함수/trigger 존재를 한 결과표로 보여준다. 테스트 사용자 mutation은 데이터 변경 위험 때문에 주석으로 명확한 transaction 절차를 제공한다.

- [ ] **Step 8: migration 정적 검증**

Run: `rg -n "to anon|using\s*\(\s*true|with check\s*\(\s*true|service_role" sql supabase/migrations/20260828000100_step2_auth_rbac.sql`

Expected: anon 권한 부여, 광범위 true 정책, service_role 사용이 0건. revoke 문과 설명 주석에서의 `anon` 문자열은 수동 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add supabase/migrations/20260828000100_step2_auth_rbac.sql sql/01-grants.sql sql/02-policies.sql sql/03-step2-verify.sql
git commit -m "인증 사용자와 RBAC RLS 추가"
```

### Task 3: cookie 기반 Supabase SSR client와 middleware

**Files:**
- Modify: `lib/supabase/client.ts`
- Modify: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`

**Interfaces:**
- Consumes: Task 1 `decideRouteAccess()`, Task 2 `core.app_user`.
- Produces: `createSupabaseBrowserClient()`, `createSupabaseServerClient()`, `updateSupabaseSession(request)`, Next middleware.

- [ ] **Step 1: browser client를 `createBrowserClient`로 교체**

```ts
import { createBrowserClient } from '@supabase/ssr';
import { requireSupabaseEnv } from './env';

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}
```

- [ ] **Step 2: server client를 cookie adapter로 교체**

`cookies()`를 await하고 `getAll()`/`setAll()` adapter를 `createServerClient()`에 전달한다. Server Component의 cookie write 예외만 catch하며 auth/query 오류는 숨기지 않는다.

- [ ] **Step 3: middleware session updater 구현**

`updateSupabaseSession(request)`는 `NextResponse.next({ request })`를 만들고 request/response 양쪽 cookie를 갱신한다. `supabase.auth.getUser()`를 호출해 검증된 user와 response를 반환한다. `getSession()`만으로 인증을 결정하지 않는다.

- [ ] **Step 4: Next middleware에서 보호 경로와 ADMIN 403 구현**

세션 user가 있으면 `core.app_user`에서 `user_id`, `role`, `active`를 조회한다. Task 1의 `decideRouteAccess()` 결과가 redirect면 `/login?next=...`, forbidden이면 `new NextResponse('접근 권한이 없습니다.', { status: 403 })`, allow면 갱신된 response를 반환한다. redirect/403 응답에도 갱신 cookie를 복사한다.

Matcher는 `/_next/static`, `/_next/image`, favicon과 정적 확장자를 제외하되 `/`, `/analysis/*`, `/workflow`, `/admin/*`, `/login`을 포함해 로그인 세션 갱신이 가능하게 한다.

- [ ] **Step 5: 정책 테스트와 타입 검사 실행**

Run: `node --test lib/auth-policy.test.ts`

Run: `npx tsc --noEmit`

Expected: route 결정 테스트 PASS, TypeScript 오류 0건.

- [ ] **Step 6: 커밋**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts lib/supabase/middleware.ts middleware.ts
git commit -m "Supabase SSR 세션과 경로 보호 추가"
```

### Task 4: auth helper와 layout 이중 보호

**Files:**
- Create: `lib/auth.ts`
- Create: `app/(legacy)/layout.tsx`
- Modify: `app/(user)/layout.tsx`
- Modify: `app/(admin)/layout.tsx`

**Interfaces:**
- Consumes: Task 1 `AppRole`, `AppUserProfile`, `normalizeRole()`, Task 3 server client.
- Produces: `AuthorizationError`, `getRole()`, `requireUser()`, `requireAdmin()`.

- [ ] **Step 1: profile 정규화 실패 테스트 추가**

`lib/auth-policy.test.ts`에 DB row의 snake_case 값을 `AppUserProfile`로 변환하는 `normalizeProfile()` 테스트를 추가한다. 잘못된 role, 빈 user_id, active=false는 각각 null 또는 비활성 profile로 명확히 구분한다.

- [ ] **Step 2: 테스트 실패 확인 후 `normalizeProfile()` 구현**

Run: `node --test lib/auth-policy.test.ts`

Expected: named export 부재로 FAIL 후 구현하고 PASS.

- [ ] **Step 3: auth helper 구현**

`requireUser()`는 `auth.getUser()` 후 `.schema('core').from('app_user').select(...).eq('user_id', user.id).maybeSingle()`을 호출한다. 세션/프로필 없음은 `redirect('/login')`, active=false는 `signOut()` 후 `redirect('/login?error=inactive')`한다. `requireAdmin()`은 `requireUser()`를 호출하고 role이 ADMIN이 아니면 `AuthorizationError(403)`를 throw한다. `getRole()`은 오류를 숨기지 않고 세션 없음만 null로 반환한다.

- [ ] **Step 4: route group layout에 helper 적용**

`(user)`와 `(legacy)` layout은 첫 렌더에서 `await requireUser()`, `(admin)` layout은 `await requireAdmin()`을 호출한다. layout이 받은 profile을 Topbar에 전달할 수 있도록 반환값을 보존한다.

- [ ] **Step 5: 테스트와 타입 검사**

Run: `npm test`

Run: `npx tsc --noEmit`

Expected: 전체 테스트 PASS, TypeScript 오류 0건.

- [ ] **Step 6: 커밋**

```bash
git add lib/auth.ts lib/auth-policy.ts lib/auth-policy.test.ts "app/(legacy)/layout.tsx" "app/(user)/layout.tsx" "app/(admin)/layout.tsx"
git commit -m "서버 인증 helper와 layout 권한 보호 추가"
```

### Task 5: 로그인·로그아웃과 next 복귀

**Files:**
- Create: `app/(auth)/login/actions.ts`
- Create: `components/auth/login-form.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/logout/actions.ts`
- Modify: `components/shell/topbar.tsx`
- Modify: `styles/components.css`

**Interfaces:**
- Consumes: Task 1 `safeNextPath()`, `defaultPathForRole()`, Task 3 server client, Task 4 profile 타입.
- Produces: `loginAction(previousState, formData)`, `logoutAction()`, 로그인 form UI.

- [ ] **Step 1: 로그인 입력 정규화 실패 테스트 작성**

`lib/auth-policy.test.ts`에 `normalizeCredentials(input: { email: unknown; password: unknown }): { email: string; password: string } | null` 테스트를 추가한다. 빈 email/password는 null, 공백이 포함된 email은 trim된 결과, password는 원문 보존을 literal 값으로 검증한다.

- [ ] **Step 2: 실패 확인 후 최소 입력 정규화 구현**

Run: `node --test lib/auth-policy.test.ts`

Expected: 새 함수 부재로 FAIL 후 구현하고 PASS.

- [ ] **Step 3: login Server Action 구현**

Action은 email/password/next를 서버에서 읽고 `signInWithPassword()`를 호출한다. 인증 실패는 `{ error: '이메일 또는 비밀번호를 확인해주세요.' }`를 반환한다. 성공 후 app_user를 조회해 inactive면 signOut하고 비활성 오류를 반환한다. active면 `.schema('core').rpc('touch_last_login')`을 호출하고 안전한 next 또는 role별 기본 경로로 redirect한다.

- [ ] **Step 4: login form과 page 구현**

client form은 `useActionState(loginAction, { error: null })`를 사용하고 email/password/hidden next 필드, 제출 버튼, `role="alert"` 오류를 렌더링한다. page는 `searchParams`를 await하고 `safeNextPath()`로 hidden next 값을 만든다. 기존 디자인 토큰과 `Panel`, `PageHeader`, `Button` 구조를 유지한다.

- [ ] **Step 5: logout 및 Topbar 구현**

`logoutAction()`은 server client `auth.signOut()` 후 `/login` redirect한다. Topbar는 `{ profile: AppUserProfile }`을 받아 사용자 이름, role badge, POST form 로그아웃 버튼을 표시한다. USER/ADMIN layout에서 동일 profile을 전달한다.

- [ ] **Step 6: CSS 토큰 기반 스타일 추가**

`styles/components.css`에 auth form, field, inline error, topbar user meta 스타일을 추가한다. TSX에 hex 색상을 쓰지 않고 기존 CSS 변수만 사용한다.

- [ ] **Step 7: 테스트와 build 전 타입 검사**

Run: `npm test`

Run: `npx tsc --noEmit`

Expected: 전체 테스트 PASS, TypeScript 오류 0건.

- [ ] **Step 8: 커밋**

```bash
git add "app/(auth)/login/actions.ts" "app/(auth)/login/page.tsx" "app/(auth)/logout/actions.ts" components/auth/login-form.tsx components/shell/topbar.tsx styles/components.css lib/auth-policy.ts lib/auth-policy.test.ts "app/(user)/layout.tsx" "app/(admin)/layout.tsx"
git commit -m "로그인 로그아웃과 원래 경로 복귀 구현"
```

### Task 6: 관리자 사용자 mutation 서비스

**Files:**
- Create: `lib/admin-users.test.ts`
- Create: `lib/admin-users.ts`
- Create: `app/(admin)/admin/users/actions.ts`

**Interfaces:**
- Consumes: Task 1 `AppRole`, `assertAllowedAdminChange()`, Task 3 server client, Task 4 `requireAdmin()`.
- Produces: `listAppUsers()`, `setUserRole()`, `setUserActive()`, `changeUserRoleAction()`, `changeUserActiveAction()`.

- [ ] **Step 1: 자기 계정 보호와 RPC 미호출 실패 테스트 작성**

```ts
test('자기 관리자 권한 제거는 DB RPC 호출 전에 거부한다', async () => {
  let called = false;
  await assert.rejects(
    setUserRole({ actorId: 'a', targetId: 'a', role: 'USER' }, async () => { called = true; }),
    /자신의 관리자 권한/,
  );
  assert.equal(called, false);
});

test('자기 비활성화는 DB RPC 호출 전에 거부한다', async () => {
  let called = false;
  await assert.rejects(
    setUserActive({ actorId: 'a', targetId: 'a', active: false }, async () => { called = true; }),
    /자신의 계정/,
  );
  assert.equal(called, false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test lib/admin-users.test.ts`

Expected: module/export 부재로 FAIL.

- [ ] **Step 3: 관리자 사용자 서비스 최소 구현**

`setUserRole(input, mutate)`와 `setUserActive(input, mutate)`는 순수 검증 후 주입된 mutation을 호출한다. 실제 gateway는 server client의 `.schema('core').rpc('admin_set_user_role', { target_user_id, next_role })`와 active RPC를 사용하며 Supabase 오류를 한국어 `AdminUserError`로 변환한다. `listAppUsers()`는 app_user를 name/email 순으로 조회하고 오류와 빈 결과를 구분할 수 있는 결과를 반환한다.

- [ ] **Step 4: 서비스 테스트 통과 확인**

Run: `node --test lib/admin-users.test.ts`

Expected: 자기 계정 차단, 유효 mutation 1회 호출, 잘못된 role 거부 테스트 PASS.

- [ ] **Step 5: Server Actions 구현**

각 Action의 첫 실행문은 `const actor = await requireAdmin()`이다. FormData의 target/role/active를 검증하고 서비스 함수를 호출한 뒤 성공 또는 안전한 오류 메시지를 query에 넣어 `/admin/users`로 redirect한다. 권한 오류는 catch해서 성공 결과로 바꾸지 않는다.

- [ ] **Step 6: 전체 테스트와 타입 검사**

Run: `npm test`

Run: `npx tsc --noEmit`

Expected: 전체 테스트 PASS, TypeScript 오류 0건.

- [ ] **Step 7: 커밋**

```bash
git add lib/admin-users.ts lib/admin-users.test.ts "app/(admin)/admin/users/actions.ts"
git commit -m "관리자 사용자 변경 서비스와 권한 검증 추가"
```

### Task 7: 관리자 사용자 관리 화면과 역할별 메뉴

**Files:**
- Create: `app/(admin)/admin/users/page.tsx`
- Create: `components/admin/user-management-table.tsx`
- Modify: `lib/menu.ts`
- Modify: `lib/menu.test.ts`
- Modify: `app/(admin)/admin/page.tsx`
- Modify: `styles/components.css`

**Interfaces:**
- Consumes: Task 4 `requireAdmin()`, Task 6 사용자 목록/Actions, STEP 1 공통 `Panel`, `Badge`, `DataTable`, `Button`.
- Produces: `/admin/users` 목록 및 role/active 변경 UI, ADMIN 전용 사용자 관리 메뉴.

- [ ] **Step 1: ADMIN 메뉴 실패 테스트 추가**

```ts
test('ADMIN 메뉴에 사용자 관리가 있고 USER 메뉴에는 없다', () => {
  assert.equal(menuByRole.admin.some((item) => item.href === '/admin/users'), true);
  assert.equal(menuByRole.user.some((item) => item.href.startsWith('/admin')), false);
});
```

- [ ] **Step 2: 테스트 실패 확인 후 메뉴 추가**

Run: `node --test lib/menu.test.ts`

Expected: ADMIN `/admin/users` 부재로 FAIL 후 `Users` icon과 메뉴 추가 뒤 PASS.

- [ ] **Step 3: 사용자 관리 page 구현**

page 첫 단계에서 `requireAdmin()`을 호출하고 `listAppUsers()`를 조회한다. query의 notice/error를 안전한 문자열로 렌더링한다. 조회 오류는 “조회에 실패했습니다”, 빈 배열은 “등록된 사용자가 없습니다”로 구분한다.

- [ ] **Step 4: 사용자 관리 table 구현**

이름, 이메일, 부서, role, active, 마지막 로그인 컬럼을 표시한다. 각 행의 role form과 active form은 Task 6 Action을 사용한다. 현재 actor 행은 role=ADMIN 변경과 active=false 버튼을 disabled하고 설명 텍스트를 제공한다. UI disabled 여부와 무관하게 Action/RPC 검증은 유지한다.

- [ ] **Step 5: 관리자 대시보드 문구 갱신과 CSS 추가**

Admin KPI의 인증 상태를 `ACTIVE`, foot을 `SSR + RLS`로 갱신하고 사용자 관리 링크를 추가한다. CSS는 기존 토큰으로 table action, status control, notice를 스타일링한다.

- [ ] **Step 6: 전체 테스트와 타입 검사**

Run: `npm test`

Run: `npx tsc --noEmit`

Expected: 전체 테스트 PASS, TypeScript 오류 0건.

- [ ] **Step 7: 커밋**

```bash
git add "app/(admin)/admin/users/page.tsx" components/admin/user-management-table.tsx lib/menu.ts lib/menu.test.ts "app/(admin)/admin/page.tsx" styles/components.css
git commit -m "관리자 사용자 관리 화면 추가"
```

### Task 8: 전체 보안·빌드·수동 검증

**Files:**
- Modify: `README.md`
- Verify: all STEP 2 files

**Interfaces:**
- Consumes: Task 1~7 전체 결과.
- Produces: 검증 근거와 수동 Supabase 적용 절차.

- [ ] **Step 1: 위험 패턴과 비밀키 노출 검사**

Run: `rg -n "service_role|sb_secret_|to anon.*(insert|update|delete)|using\s*\(\s*true|with check\s*\(\s*true" app components lib sql supabase -g '!*.md'`

Expected: 브라우저/서버 코드의 secret/service role 0건, anon write grant 0건, 광범위 true 정책 0건.

- [ ] **Step 2: 화면 컴포넌트 hex 하드코딩 검사**

Run: `rg -n "#[0-9a-fA-F]{3,8}" app components lib -g '*.tsx' -g '*.ts'`

Expected: 화면/로직 파일의 hex 색상 0건.

- [ ] **Step 3: 전체 테스트 실행**

Run: `npm test`

Expected: 기존 SCM 테스트와 신규 auth/admin/menu 테스트 모두 PASS, 실패 0건.

- [ ] **Step 4: production build 실행**

Run: `npm run build`

Expected: Next.js compile, lint/typecheck, page generation 성공.

- [ ] **Step 5: 로컬 HTTP 보호 동작 확인**

Run: `npm run dev`

브라우저 또는 HTTP client로 세션 없이 `/analysis/leadtime`과 `/admin/users`를 요청해 각각 `/login?next=...` redirect를 확인한다. migration이 원격 DB에 적용되지 않은 경우 로그인 이후 검증은 수동 설정 항목으로 남긴다.

- [ ] **Step 6: 원격 Supabase 적용 후 역할별 시나리오 확인**

`supabase db push` 또는 Dashboard SQL Editor로 migration을 적용한 뒤 USER의 `/admin/users` 403, ADMIN 접근 성공, USER의 관리자 Action/RPC 거부, ADMIN role 변경 audit 생성, 자기 강등/비활성화 거부를 확인한다. 최초 ADMIN은 SQL Editor에서 한 번만 지정한다.

- [ ] **Step 7: README 수동 설정 갱신**

필요한 migration 적용, Exposed schemas, 최초 ADMIN SQL, USER/ADMIN 테스트 계정 절차를 `README.md`에 한국어로 추가한다. secret key 추가를 안내하지 않는다.

- [ ] **Step 8: 최종 diff와 상태 확인**

Run: `git diff --check`

Run: `git status --short`

Expected: whitespace 오류 0건. 의도한 STEP 2 파일만 변경됨.

- [ ] **Step 9: 최종 커밋**

```bash
git add README.md
git commit -m "STEP2 인증 운영 절차 문서화"
```
