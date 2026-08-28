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

## 2026-08-28 — STEP 3 Forecast 설정 view의 SQL 문법 오류

### 오류

`20260828000200_step3_data_isolation.sql` 실행 시 다음 오류가 발생했습니다.

```text
ERROR: 42601: syntax error at or near "from"
LINE 174: ) order by p.policy_key from core.policy_config p where p.active)
```

### 원인

`analytics.v_forecast_setting_admin`의 정책 JSON 집계 구문에서 `jsonb_agg(...)`의 닫는 괄호가 누락되어 `order by` 뒤의 `from`을 SQL parser가 올바르게 해석하지 못했습니다.

### 해결책

`jsonb_build_object(...)`를 `jsonb_agg(...)` 안에 넣고, `order by p.policy_key` 뒤에 aggregate 닫는 괄호를 추가했습니다. 수정된 migration 전체를 SQL Editor에 다시 붙여넣고, 일부 구문이 아닌 전체 쿼리를 실행해야 합니다.

### 검증

로컬 회귀 테스트와 전체 테스트, TypeScript 검사, production build를 다시 실행합니다. Supabase에서 migration을 재실행한 뒤 `analytics.v_forecast_setting_admin` view가 생성되는지 확인합니다.

## 2026-08-28 — 수정 전 STEP 3 migration 재실행으로 동일 문법 오류 반복

### 오류

Supabase SQL Editor에서 다음과 같은 오류가 다시 발생했습니다.

```text
ERROR: 42601: syntax error at or near "from"
LINE 175: ) order by p.policy_key from core.policy_config p where p.active)
```

### 원인

오류 메시지의 `) order by p.policy_key from` 형태는 수정 전 migration에 남아 있는 구문입니다. 최신 파일은 `order by p.policy_key` 다음에 `jsonb_agg`를 닫도록 수정되어 있으므로, SQL Editor에 이전 내용이 남아 있거나 수정 전 파일을 다시 실행한 상황입니다.

### 해결책

SQL Editor의 기존 쿼리를 모두 삭제하고 최신 `20260828000200_step3_data_isolation.sql` 전체를 새 쿼리에 붙여넣습니다. 아래 형태가 포함되어 있어야 합니다.

```sql
jsonb_agg(
  jsonb_build_object(...)
  order by p.policy_key
) from core.policy_config p where p.active
```

`Run selected`가 아니라 전체 쿼리를 실행합니다.

## 2026-08-28 — Forecast 기간 설정의 학습·검증 기간 중복 오류

### 오류

기간 설정 SQL 실행 시 다음 오류가 발생했습니다.

```text
ERROR: 23514: new row for relation "forecast_setting" violates check constraint "forecast_setting_check2"
```

### 원인

입력한 기간은 학습 기간이 `2026-08-20`부터 `2026-08-26`까지이고, 검증 기간이 `2026-08-23`부터 `2026-08-27`까지라 서로 겹칩니다. STEP 3은 검증 데이터가 학습에 섞이는 것을 막기 위해 `test_start > train_end` 조건을 적용합니다.

### 해결책

검증 시작일을 학습 종료일 다음 날 이후로 변경합니다. 예를 들어 아래처럼 실행합니다.

```sql
update core.forecast_setting
set train_start = '2026-08-20',
    train_end = '2026-08-26',
    test_start = '2026-08-27',
    test_end = '2026-08-27',
    granularity = 'DAY'
where setting_id = 1;
```

실제 보유 데이터가 해당 기간을 모두 포함하는지는 `analytics.v_data_coverage`에서 `train_window_ok`, `test_window_ok`로 확인합니다.

## 2026-08-28 — STEP 8 Python Forecast migration의 선행 테이블 누락

### 오류

Supabase SQL Editor에서 `20260828000700_step8_python_forecast.sql` 실행 시 다음 오류가 발생했습니다.

```text
ERROR: 42P01: relation "core.model_config" does not exist
```

### 원인

`core.model_config`는 STEP 6 migration인 `20260828000500_step6_forecast_engine.sql`에서 생성됩니다. STEP 8 migration은 이 테이블의 `engine` 제약조건을 확장하고 Python 모델을 등록하므로, STEP 6이 적용되지 않은 프로젝트에서는 해당 구문에서 중단됩니다.

### 해결책

먼저 아래 순서로 선행 migration을 전체 실행합니다.

```text
20260828000500_step6_forecast_engine.sql
20260828000600_step7_backtest_champion.sql
20260828000700_step8_python_forecast.sql
```

각 파일은 SQL Editor에서 기존 쿼리를 비운 새 query에 전체 붙여넣고 `Run`으로 실행합니다. 아래 확인 쿼리로 STEP 6 테이블이 존재하는지 먼저 확인할 수 있습니다.

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'core'
  and table_name in ('model_config', 'model_version', 'forecast_run', 'forecast_result')
order by table_name;
```

STEP 8만 먼저 실행해서 실패한 경우, 선행 migration을 적용한 뒤 STEP 8 파일 전체를 다시 실행합니다. `create table if not exists`와 `on conflict` 구문이 있어 이미 생성된 STEP 6·7 객체는 유지됩니다.

### 검증

확인 쿼리 결과에 `model_config`, `model_version`, `forecast_run`, `forecast_result`가 각각 표시되고, 이후 STEP 8 실행 후 다음 쿼리에서 Python 모델이 표시되는지 확인합니다.

```sql
select model_id, engine, enabled
from core.model_config
where engine = 'PYTHON'
order by model_id;
```

## 2026-08-28 — STEP 8 Python Forecast migration의 Demand Profile 뷰 누락

### 오류

Supabase SQL Editor에서 `20260828000700_step8_python_forecast.sql` 실행 시 다음 오류가 발생했습니다.

```text
ERROR: 42P01: relation "analytics.v_sku_demand_profile" does not exist
```

### 원인

`analytics.v_sku_demand_profile`은 STEP 5 migration인 `20260828000400_step5_demand_profile.sql`에서 생성됩니다. STEP 8 migration은 Python Forecast Service가 Demand Profile을 조회할 수 있도록 이 뷰에 `service_role` SELECT 권한을 부여하므로, STEP 5가 적용되지 않은 상태에서는 마지막 `grant` 구문에서 중단됩니다.

### 해결책

STEP 5부터 아래 순서로 각 migration 파일 전체를 새 SQL Editor query에서 실행합니다.

```text
20260828000400_step5_demand_profile.sql
20260828000500_step6_forecast_engine.sql
20260828000600_step7_backtest_champion.sql
20260828000700_step8_python_forecast.sql
```

이미 성공한 migration은 다시 실행하지 않아도 됩니다. STEP 5 실행 후 아래 쿼리로 뷰 존재 여부를 확인합니다.

```sql
select table_schema, table_name
from information_schema.views
where table_schema = 'analytics'
  and table_name in ('v_sku_demand_profile', 'v_demand_profile_kpi');
```

결과에 두 뷰가 표시되면 STEP 8 파일 전체를 다시 실행합니다. 화면에 보이는 `Diagnose blocked queries` 패널은 현재 SQL 오류의 원인이 아니며 닫아도 됩니다.
## 2026-08-28 — Vercel 배포 후 Routing Middleware 실행 실패

### 오류

Vercel 배포 사이트 접속 시 다음 오류 화면이 표시되었습니다.

```text
500: INTERNAL_SERVER_ERROR
Code: MIDDLEWARE_INVOCATION_FAILED
This Routing Middleware has crashed.
```

### 원인

`middleware.ts`는 모든 보호 경로 요청에서 `lib/supabase/middleware.ts`를 실행합니다. 이 파일은 `NEXT_PUBLIC_SUPABASE_URL` 또는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 없으면 `requireSupabaseEnv()`에서 의도적으로 예외를 발생시킵니다. 로컬 `.env.local` 값은 Git에 커밋되지 않으므로 Vercel 프로젝트 환경변수에는 자동으로 전달되지 않습니다.

### 해결책

Vercel 프로젝트의 `Settings → Environment Variables`에 아래 두 값을 추가합니다.

```text
NEXT_PUBLIC_SUPABASE_URL=https://<프로젝트-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

실제 배포 대상에 맞게 `Production`에 추가하고, Preview 배포도 확인하려면 `Preview`에도 추가합니다. 값을 저장한 뒤 `Redeploy`를 실행합니다. Supabase secret key(`sb_secret_...`)는 입력하지 않습니다.

### 확인

Vercel 재배포가 완료된 뒤 사이트에 다시 접속합니다. 환경변수 이름이 정확하고 값 앞뒤에 공백이나 따옴표가 없어야 합니다. 같은 오류가 계속되면 Vercel Runtime Logs에서 첫 번째 `MIDDLEWARE_INVOCATION_FAILED` 로그를 확인합니다.

## 2026-08-28 — Vercel 빌드의 npm·Webpack 경고

### 로그

```text
npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts: sharp@0.34.5
Compiled with warnings
Skipped not serializable cache item ... styles/components.css
```

### 판단

위 내용은 `npm run build`를 중단시키는 오류가 아니라 경고입니다. `sharp`의 설치 스크립트가 승인되지 않았다는 안내와 Webpack 캐시가 CSS 경고 객체를 직렬화하지 못해 해당 캐시 항목을 건너뛰었다는 의미입니다. 이 로그만으로 `MIDDLEWARE_INVOCATION_FAILED`의 원인이라고 볼 수 없습니다.

### 해결책

Vercel 빌드가 `Compiled successfully` 또는 최종 `Build completed`로 끝났다면 우선 조치하지 않아도 됩니다. `sharp` 최적화 기능이 실제로 실패하거나 빌드가 중단될 때만 프로젝트의 패키지 실행 스크립트 승인 설정을 검토합니다. 배포 후 500 오류가 계속되면 이 경고가 아니라 Vercel Runtime Logs의 middleware 상세 오류와 환경변수 설정을 먼저 확인합니다.
