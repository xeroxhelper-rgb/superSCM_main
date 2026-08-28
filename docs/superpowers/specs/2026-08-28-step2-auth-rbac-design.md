# STEP 2 인증·Role·RBAC 설계

## 목표

Next.js와 Supabase 양쪽에서 동일한 사용자 역할을 사용하고, ADMIN과 USER 권한을 프론트엔드 UX, 서버 실행 경계, PostgreSQL 권한/RLS 세 계층에서 모두 강제한다. 메뉴 노출 여부는 편의 기능으로만 취급하며 권한 판정의 근거로 사용하지 않는다.

## 현행 구조와 문제점

- `@supabase/ssr`는 설치되어 있지만 서버와 브라우저 클라이언트는 `@supabase/supabase-js`의 세션 없는 클라이언트를 사용한다.
- 로그인 화면은 placeholder이며 middleware와 logout 흐름이 없다.
- `(user)`와 `(admin)` route group은 있지만 layout에서 사용자나 역할을 검증하지 않는다.
- `sql/01-grants.sql`은 `anon`에 `core`, `analytics` 조회 권한을 준다.
- `sql/02-policies.sql`은 `anon`과 `authenticated` 모두에게 `core.leadtime_plan`, `core.usage_profile` 쓰기를 허용하고 `using (true)`와 `with check (true)`를 사용한다.
- 기존 `public` 업무 테이블 migration에는 RLS가 없다.
- ADMIN/USER 메뉴 데이터는 `lib/menu.ts`에서 분리할 기반이 있지만 사용자 세션과 연결되지 않았다.

## 채택한 접근

역할은 사용자 JWT 메타데이터가 아니라 `core.app_user`에서 조회한다. 세션의 `auth.uid()`가 사용자 식별의 유일한 기준이며, 활성 사용자 여부와 ADMIN 판정은 재사용 가능한 `core.is_admin()`에서 수행한다.

Custom Claims는 토큰 갱신과 Auth Hook 운영이 필요해 현재 범위에서 제외한다. service role client도 필요하지 않으므로 만들지 않는다. 관리자 mutation은 사용자 세션으로 제한된 PostgreSQL RPC를 호출하며, DB가 권한·자기 계정 보호·audit를 최종 강제한다.

## 데이터 모델

### `core.app_user`

| 컬럼 | 타입 | 규칙 |
|---|---|---|
| `user_id` | `uuid` | PK, `auth.users(id)` FK, 삭제 연동 |
| `email` | `text` | 필수 |
| `name` | `text` | 필수, metadata 이름 또는 이메일 앞부분 기본값 |
| `department` | `text` | nullable |
| `role` | `text` | `ADMIN` 또는 `USER`, 기본 `USER` |
| `active` | `boolean` | 기본 `true` |
| `last_login_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | 기본 `now()` |
| `updated_at` | `timestamptz` | 기본 `now()`, update trigger 적용 |

`auth.users` INSERT trigger는 `core.handle_new_auth_user()`를 호출한다. 함수는 `security definer`와 제한된 `search_path`를 사용하고 신규 사용자를 항상 `USER`로 생성한다. 클라이언트 metadata의 role 값은 무시한다.

### `core.audit_log`

| 컬럼 | 타입 | 규칙 |
|---|---|---|
| `id` | `bigint generated always as identity` | PK |
| `actor` | `uuid` | `auth.users(id)` FK, 삭제 시 null |
| `action` | `text` | 예: `USER_ROLE_CHANGED`, `USER_ACTIVE_CHANGED` |
| `target_type` | `text` | 이 단계에서는 `APP_USER` |
| `target_id` | `text` | 대상 `user_id` 문자열 |
| `before` | `jsonb` | 변경 전 role/active 값 |
| `after` | `jsonb` | 변경 후 role/active 값 |
| `at` | `timestamptz` | 기본 `now()` |

`core.app_user`의 role 또는 active가 변경되면 AFTER UPDATE trigger가 audit 행을 기록한다. 따라서 앱 Server Action을 거치지 않은 허용된 DB 변경도 기록된다. 단, SQL Editor의 최초 ADMIN 부트스트랩은 `auth.uid()`가 없으므로 actor가 null이다.

## DB 권한과 RLS

### 공통 함수

- `core.is_admin()` → 현재 `auth.uid()`에 대응하는 `core.app_user`가 active ADMIN이면 true.
- `core.touch_last_login()` → 현재 로그인 사용자의 `last_login_at`만 갱신.
- `core.admin_set_user_role(target_user_id uuid, next_role text)` → ADMIN만 호출, 자기 ADMIN 권한 제거 금지.
- `core.admin_set_user_active(target_user_id uuid, next_active boolean)` → ADMIN만 호출, 자기 비활성화 금지.

관리 RPC는 `security definer`를 사용하되 함수 내부 첫 단계에서 호출자의 `auth.uid()`와 `core.is_admin()`을 검증한다. 대상 존재 여부, role 허용값, 자기 계정 제한도 DB에서 검증한다. 함수 실행 권한은 `authenticated`에만 주며 anon에서는 revoke한다.

### 권한 행렬

| 대상 | anon | authenticated USER | authenticated ADMIN |
|---|---|---|---|
| `analytics` 뷰 | 차단 | SELECT | SELECT |
| 허용된 `core` 업무 테이블 | 차단 | SELECT | SELECT, 정책으로 허용된 mutation |
| `core.app_user` | 차단 | 자기 행 SELECT | 전체 SELECT |
| `core.audit_log` | 차단 | 차단 | SELECT |
| 사용자 role/active 변경 RPC | 차단 | 함수 내부에서 거부 | 허용 |

기존 `anon` schema/table grant를 revoke한다. `core.leadtime_plan`과 `core.usage_profile`의 `수업용 전체 허용` 정책을 삭제하고, authenticated 조회 정책과 ADMIN mutation 정책으로 교체한다. `using (true)` 또는 `with check (true)`인 광범위 정책은 남기지 않는다.

`public` 업무 테이블은 이번 화면에서 사용되지 않지만 anon 쓰기를 방지하기 위해 RLS를 활성화하고 anon의 DML 권한을 revoke한다. 기존 계산 뷰와 계산식은 변경하지 않는다.

## Supabase 클라이언트

- `lib/supabase/client.ts`: `@supabase/ssr`의 `createBrowserClient()` 사용.
- `lib/supabase/server.ts`: `cookies()`와 `createServerClient()`를 사용해 요청 쿠키의 세션을 읽고 갱신한다. Server Component에서 cookie write가 거부되는 경우는 무시하고 middleware가 갱신을 담당한다.
- `lib/supabase/middleware.ts`: request/response cookie adapter로 세션을 갱신하고 검증된 user를 반환한다.
- service role 키와 client는 추가하지 않는다.

## 인증 helper

`lib/auth.ts`는 다음 계약을 제공한다.

- `getRole()` → 활성 세션과 `core.app_user`를 조회해 `ADMIN`, `USER`, 또는 null 반환.
- `requireUser()` → 세션 없음 또는 비활성/프로필 없음이면 로그인 redirect 또는 권한 오류. 성공 시 user와 profile 반환.
- `requireAdmin()` → `requireUser()` 결과가 ADMIN이 아니면 403 성격의 `AuthorizationError`를 발생. Server Action은 이를 사용자 메시지로 변환하고 route 보호는 403 응답을 사용한다.

브라우저가 보낸 role 값은 어떤 helper나 mutation에서도 사용하지 않는다.

## middleware와 route 보호

보호 경로는 `/`, `/analysis/*`, `/workflow`, `/admin/*`이다. `/login`, 정적 파일, Next 내부 경로, health endpoint는 공개한다.

1. middleware가 Supabase 세션을 cookie 기반으로 갱신한다.
2. 미로그인 사용자는 `/login?next=<pathname+search>`로 redirect한다.
3. `/admin/*` 요청은 `core.app_user`의 active role을 조회한다.
4. USER 또는 비활성 사용자는 middleware에서 상태 코드 403 응답을 받는다.
5. `(user)`, `(admin)`, `(legacy)` layout도 각각 `requireUser()` 또는 `requireAdmin()`을 호출해 middleware 우회에 대비한다.

## 로그인과 로그아웃

로그인은 Server Action에서 email/password를 검증하고 `signInWithPassword()`를 호출한다. 실패 시 비밀번호나 사용자 존재 여부를 구분하지 않는 한국어 오류를 표시한다. 성공하면 `core.touch_last_login()`을 호출하고 검증된 `next` 경로로 redirect한다.

`next`는 `/`로 시작하는 내부 경로만 허용하며 `//`, 스킴 URL, `/login` 순환 경로는 거부한다. next가 없으면 ADMIN은 `/admin`, USER는 `/`로 이동한다.

로그아웃은 Server Action에서 `signOut()`을 호출한 뒤 `/login`으로 redirect한다. Topbar에는 로그인 링크 대신 사용자 이름/역할과 로그아웃 form을 표시한다.

## 메뉴

`lib/menu.ts`의 `menuByRole`을 계속 단일 원본으로 사용한다. ADMIN 메뉴에는 `/admin/users`를 추가하고, USER layout은 user 메뉴, ADMIN layout은 admin 메뉴를 표시한다. 메뉴 숨김은 UX일 뿐이며 middleware, layout, Server Action, RLS/RPC 검증을 대체하지 않는다.

## 관리자 사용자 관리

`/admin/users` Server Component는 `requireAdmin()` 후 `core.app_user` 목록을 조회한다. 표에는 이름, 이메일, 부서, role, active, 마지막 로그인 시각을 표시한다.

role 변경과 active 변경은 각각 Server Action을 사용한다. Action의 첫 실행 단계는 `requireAdmin()`이며, 입력을 서버에서 검증한 뒤 DB RPC를 호출하고 `/admin/users`를 revalidate한다. 현재 사용자 행에서는 ADMIN 해제와 비활성화 컨트롤을 disabled 처리하지만, 실제 금지는 DB RPC가 강제한다.

## 오류 처리

- 로그인 실패: 동일한 일반 오류 메시지를 반환한다.
- 비활성 사용자: 세션을 로그아웃 처리하고 로그인 화면에서 비활성 안내를 표시한다.
- USER의 관리자 Action 직접 호출: 권한 오류 결과를 반환하고 mutation을 수행하지 않는다.
- 대상 사용자 없음 또는 잘못된 role: DB RPC 오류를 안전한 한국어 메시지로 변환한다.
- 사용자 목록 조회 오류와 빈 목록은 구분해 표시한다.

## 테스트 전략

### 자동 단위 테스트

- 안전한 `next` 경로 정규화와 외부 redirect 차단.
- role 값 정규화와 active 사용자 판정.
- 자기 ADMIN 권한 제거 금지.
- 자기 계정 비활성화 금지.
- USER/ADMIN 메뉴 분리와 `/admin/users` 메뉴 존재.
- 관리자 변경 서비스가 인증되지 않은 호출과 USER 호출을 mutation 전에 거부.

각 동작은 실패하는 테스트를 먼저 작성하고 최소 구현으로 통과시킨다.

### SQL 검증

별도 검증 SQL에서 다음을 확인한다.

- anon에 core/analytics 업무 데이터 DML 권한이 없음.
- 위험한 `using (true)` 정책이 없음.
- USER 세션은 관리자 RPC 호출 거부.
- ADMIN role/active 변경 후 audit_log 행 생성.
- ADMIN 자신의 role 강등과 active=false가 거부됨.

원격 Supabase에 migration을 적용해야 세션 기반 SQL 검증을 실행할 수 있다. 로컬 환경에 Supabase CLI와 Docker가 없으면 이 항목은 수동 설정/검증으로 보고한다.

### 프로젝트 검증

- `npm test`
- `npm run build`
- 개발 서버에서 미로그인 redirect, USER 403, ADMIN 사용자 관리 접근을 수동 확인

## migration과 운영 적용

인증·RBAC 객체는 새 migration `supabase/migrations/20260828000100_step2_auth_rbac.sql`에 추가한다. 기존 `sql/01-grants.sql`, `sql/02-policies.sql`도 같은 안전 정책으로 갱신하여 오래된 수업용 스크립트를 실행해도 권한이 다시 열리지 않게 한다.

적용 후 수동 단계는 다음과 같다.

1. Supabase migration 적용.
2. Auth에서 최초 사용자를 생성하거나 가입시켜 `core.app_user` 자동 생성을 확인.
3. SQL Editor에서 해당 사용자의 role을 `ADMIN`으로 한 번 승격.
4. Exposed schemas에 필요한 `core`, `analytics`가 포함되어 있는지 확인.
5. USER와 ADMIN 테스트 계정으로 redirect, 403, 관리자 mutation, audit 기록을 확인.

## 범위 제외

- 회원가입 UI, 비밀번호 재설정, MFA, SSO.
- 관리자에 의한 Auth 사용자 생성/삭제.
- Custom Claims 또는 Auth Hook.
- service role client.
- 기존 SCM 계산 SQL과 분석 모델 변경.
