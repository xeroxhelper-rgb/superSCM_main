# 오류 기록

## 2026-08-28 — Next.js route group 경로 충돌

### 오류

`npm run build`에서 다음 오류가 발생했습니다.

```text
You cannot have two parallel pages that resolve to the same path.
Please check /(admin)/page and /(user)/page.
```

### 원인

Next.js의 route group 폴더명인 `(admin)`과 `(user)`는 URL 경로에 포함되지 않습니다. 따라서 `app/(admin)/page.tsx`와 `app/(user)/page.tsx`가 모두 `/` 경로로 해석되어 충돌했습니다.

### 해결책

사용자 홈은 `app/(user)/page.tsx`에서 `/`로 유지하고, 관리자 홈은 `app/(admin)/admin/page.tsx`로 이동해 `/admin` 경로가 되도록 분리합니다. 관리자 layout은 `app/(admin)/layout.tsx`에 유지합니다.

### 검증

수정 후 `npm run build`를 다시 실행해 route 충돌이 사라졌는지 확인합니다.

## 2026-08-28 — Supabase migration의 존재하지 않는 테이블 오류

### 오류

SQL Editor에서 `20260828000100_step2_auth_rbac.sql` 실행 시 다음 오류가 발생했습니다.

```text
ERROR: 42P01: relation "public.planning_runs" does not exist
CONTEXT: SQL statement "alter table public.planning_runs enable row level security"
```

### 원인

현재 Supabase 프로젝트에는 `public.planning_runs` 등 기존 업무 테이블이 생성되어 있지 않은 상태인데, STEP 2 migration이 해당 테이블들이 항상 존재한다고 가정하고 RLS를 적용하고 있었습니다.

### 해결책

public 업무 테이블이 실제로 존재하는 경우에만 RLS와 조회 정책을 적용하도록 migration의 동적 SQL에 `to_regclass()` 존재 여부 검사를 추가했습니다. 없는 테이블을 임의로 생성하지 않으므로 현재 DB 구조를 보존합니다.

수정된 migration 전체 내용을 다시 SQL Editor에서 실행하세요. SQL Editor가 앞선 실행을 transaction으로 되돌렸다면 전체 migration을 다시 실행해야 합니다.

### 검증

수정된 migration은 public 업무 테이블이 없는 환경에서도 해당 구간을 건너뛰며, `core.app_user`, `core.audit_log`, 인증 함수와 RLS를 계속 생성합니다.

## 2026-08-28 — `core.is_admin()` 함수가 없다는 오류

### 오류

SQL Editor에서 일부 구문만 선택해 실행할 때 다음 오류가 발생했습니다.

```text
ERROR: 42883: function core.is_admin() does not exist
```

### 원인

`core.is_admin()` 함수 생성문보다 뒤에 있는 RLS 정책만 선택하여 실행했기 때문입니다. 화면에는 이전 migration의 보호되지 않은 `DO` 블록과 수정된 `DO` 블록이 함께 보였으므로, 최신 파일 전체가 아닌 혼합된 SQL도 실행된 상태입니다.

### 해결책

1. SQL Editor의 기존 내용을 모두 삭제합니다.
2. 수정된 migration 파일 전체를 새 query에 붙여넣습니다.
3. `Run selected`가 아니라 전체 선택 후 실행합니다.
4. `core.is_admin()` 함수가 생성된 뒤 RLS 정책이 생성되므로 중간 구문만 따로 실행하지 않습니다.

### 검증

실행 후 다음 쿼리로 함수 존재 여부를 확인할 수 있습니다.

```sql
select routine_schema, routine_name
from information_schema.routines
where routine_schema = 'core'
  and routine_name = 'is_admin';
```
## 2026-09-04 — Supabase Dashboard `Failed to fetch (api.supabase.com)`

### 오류

Supabase SQL Editor에서 실행할 때 `Failed to fetch (api.supabase.com)` 알림이 표시됩니다.

### 원인

이 메시지는 SQL 문법 오류나 `analytics` 스키마 조회 오류가 아니라, Supabase Dashboard가 관리 API 호스트인 `api.supabase.com`에 요청을 보내지 못했다는 뜻입니다. 프로젝트 코드의 `.env.local`에는 Supabase URL과 publishable 키가 설정되어 있고 프로젝트 도메인의 DNS도 정상적으로 확인되었습니다. 따라서 현재 증상은 브라우저 네트워크, VPN/프록시, 보안 확장 프로그램 또는 Supabase API Gateway의 일시적인 장애 가능성이 큽니다.

### 해결책

1. Supabase 상태 페이지에서 API Gateway 장애 여부를 확인하고 잠시 후 다시 실행합니다.
2. 시크릿 창 또는 다른 브라우저에서 Supabase에 다시 로그인한 뒤 실행합니다.
3. VPN·프록시·광고 차단/보안 확장 프로그램을 잠시 끄거나 다른 네트워크(모바일 핫스팟)에서 시도합니다.
4. 같은 오류가 SQL Editor뿐 아니라 프로젝트 화면 전반에서 계속되면 브라우저 개발자 도구의 Network 탭에서 `api.supabase.com` 요청이 `blocked`, `timeout`, `5xx` 중 무엇인지 확인합니다.
5. 오류가 프로젝트 API 요청에서만 발생하면 SQL Editor 문제가 아니므로, 프로젝트 URL·publishable 키와 API 스키마 노출 설정을 확인합니다. 이 경우에는 `api.supabase.com`이 아니라 프로젝트의 `*.supabase.co/rest/v1` 요청 응답도 함께 확인해야 합니다.

### 검증

현재 실행 환경에서는 외부 HTTPS 소켓이 정책상 차단되어 실제 `api.supabase.com` 응답 코드는 확인하지 못했습니다. 로컬 DNS는 정상이며, 브라우저에서 재시도 후 SQL Editor가 정상 실행되는지 확인합니다.

## 2026-09-04 — Supabase SQL Editor `Query is too large`

### 오류

SQL Editor에서 `Query is too large to be run via the SQL Editor. Run this query by connecting to your database directly.` 메시지가 표시됩니다.

### 원인

SQL 문 자체가 잘못된 것이 아니라, Supabase SQL Editor가 한 번에 전송·실행할 수 있는 쿼리 크기 제한을 초과한 것입니다. 대용량 `INSERT`, CSV 덤프, 여러 테이블 생성문이 합쳐진 `dump.sql` 같은 파일에서 주로 발생합니다.

### 해결책

1. 긴 SQL을 테이블·기능별로 나누어 SQL Editor에서 순서대로 실행합니다.
2. 스키마 변경은 저장소의 `supabase/migrations/`에 마이그레이션 파일로 저장한 뒤 Supabase CLI의 `supabase db push`로 배포합니다.
3. 대량 데이터 적재는 SQL Editor에 붙여넣지 말고 PostgreSQL 직접 연결 방식(`psql` 또는 Supabase CLI)으로 실행합니다.
4. 운영/Production 데이터베이스에서는 실행 전 백업과 대상 프로젝트를 확인하고, 원본 `raw` 데이터는 직접 수정하지 않습니다.

### 검증

이 오류는 쿼리 내용이 서버까지 실행되기 전에 SQL Editor의 크기 제한에서 발생하므로, 쿼리를 작은 단위로 분리했을 때 실행되는지 확인합니다. 분리 후 `relation does not exist`, 권한, 중복 키 등의 별도 오류가 나오면 그 오류를 개별적으로 해결해야 합니다.

이번 `02-data-01.sql`은 UTF-8 기준 약 1,968,575바이트(약 1.88MiB), 27,712줄이며 `raw.dim_model`과 `raw.dim_item`에 대한 `INSERT` 블록 56개가 들어 있습니다. 파일 상단의 “전체를 붙여넣고 실행” 주석은 현재 SQL Editor 제한과 맞지 않으므로, `INSERT` 블록 단위로 나누어 실행하거나 직접 DB 연결을 사용합니다.

## 2026-09-04 — Agent 실데이터 직접 Node 실행 시 extensionless import 오류

### 오류

Agent Tool을 Node에서 직접 실행해 `602K02693` 실데이터를 확인할 때 다음 오류가 ToolResult의 `reason`으로 반환됩니다.

```text
Directory import '.../lib/supabase' is not supported resolving ES modules from lib/scm.ts
```

### 원인

현재 `lib/scm.ts`가 `./supabase`처럼 확장자 없는 기존 barrel import를 사용합니다. Next.js 번들러는 이를 해석하지만, Node의 직접 TypeScript/ESM 실행기는 `lib/supabase/` 디렉터리 import를 지원하지 않습니다.

### 처리

이번 검증 범위는 Agent 기능 추가가 아니므로 기존 `lib/scm.ts` import 구조는 변경하지 않았습니다. 실제 애플리케이션 경로는 Next.js가 번들링하므로 production build에서 정상 처리됩니다. 실데이터 검증은 `/agent` 화면 또는 Next.js 서버 경로에서 수행합니다.

### 검증

`npm run build`에서 `/agent`, `/`, `/analysis/leadtime`, `/analysis/stockout` 라우트가 정상 생성되고 exit code 0을 확인했습니다. Node 직접 실행 시에는 위 제한으로 실제 Supabase 행을 출력하지 않고 ToolResult의 `ok=false`, `reason`만 반환합니다.
