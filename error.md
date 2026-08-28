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
