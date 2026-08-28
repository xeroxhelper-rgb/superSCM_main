# STEP 3 데이터 모델 확장과 학습·검증 격리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** raw 입력 구조와 core 정책·forecast 설정을 확장하고, train/test 데이터가 DB view 경계에서 분리되도록 구현한다.

**Architecture:** 기존 raw 테이블은 ALTER로 적재 추적 컬럼만 추가하고 신규 raw 테이블은 append-friendly 구조로 만든다. forecast 기간은 `core.forecast_setting`에 저장하며 `core.v_train_demand`와 `core.v_test_actual`이 각각 설정된 기간만 반환한다. 관리자 화면은 analytics 통합 view만 조회한다.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase PostgreSQL, 순수 CSS, Node test runner

**Spec:** `docs/superpowers/specs/2026-08-28-step3-data-isolation-design.md`

## Global Constraints

- raw 원본 데이터는 직접 수정하지 않으며 기존 테이블은 DROP/RECREATE하지 않는다.
- train/test 날짜를 TypeScript 또는 계산 코드에 고정하지 않는다.
- Forecast/Demand Profile 학습 경로는 `core.v_train_demand`만 사용하고 Backtest는 `core.v_test_actual`만 사용한다.
- 계산 불가 값과 기간 미설정 값은 null로 유지하며 0으로 임의 치환하지 않는다.
- anon 접근은 차단하고 policy/config mutation은 ADMIN만 허용한다.
- 새 CSS 프레임워크와 secret/service role key를 추가하지 않는다.

---

### Task 1: migration 계약 테스트와 raw 적재 추적 모델

**Files:**
- Create: `lib/step3-data-contract.test.ts`
- Create: `supabase/migrations/20260828000200_step3_data_isolation.sql`

**Interfaces:**
- Produces: `raw.business_event`, `raw.sales_order`, `raw.item_substitute`; raw 적재 추적 컬럼; `core.policy_config`, `core.outlier_rule`, `core.item_policy`, `core.forecast_setting`.
- Consumes: 기존 raw 테이블 `shipment_log`, `supplier_master`, `item_master`, `inventory`, `usage_history`, `forecast`, `goods_receipt`, `purchase_order`와 기존 `core` 스키마.

- [ ] **Step 1: 계약 테스트 작성**

테스트는 migration 텍스트에 기존 raw 8개와 신규 raw 3개에 `batch_id`, `source_type`, `loaded_at`, `source_record_id`가 포함되는지, 정책·설정 테이블과 날짜 컬럼이 존재하는지 확인한다.

- [ ] **Step 2: 테스트가 migration 부재로 실패하는지 확인**

Run: `node --test lib/step3-data-contract.test.ts`

Expected: migration 파일 또는 필수 SQL 객체 문자열 부재로 FAIL.

- [ ] **Step 3: idempotent migration 작성**

기존 raw 입력 테이블에는 다음을 `add column if not exists`로 추가한다.

```sql
batch_id uuid,
source_type text,
loaded_at timestamptz not null default now(),
source_record_id text
```

신규 raw 테이블은 `id bigint generated always as identity primary key`, 업무 컬럼, 동일 추적 컬럼으로 만든다. 정책 테이블은 typed value와 설명을 저장하고, `item_policy`는 `item_id`를 primary key로 하며 MOQ/pack size/service level을 nullable로 둔다. `forecast_setting`은 `id smallint primary key check (id = 1)`, nullable train/test date와 `granularity`를 가진 단일 행을 seed한다.

- [ ] **Step 4: 계약 테스트 통과 확인**

Run: `node --test lib/step3-data-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/step3-data-contract.test.ts supabase/migrations/20260828000200_step3_data_isolation.sql
git commit -m "STEP3 raw 데이터와 정책 설정 모델 추가"
```

### Task 2: train/test 격리 view와 coverage view

**Files:**
- Create: `lib/step3-isolation.test.ts`
- Modify: `supabase/migrations/20260828000200_step3_data_isolation.sql`

**Interfaces:**
- Produces: `core.v_train_demand`, `core.v_test_actual`, `analytics.v_data_coverage`, `analytics.v_forecast_setting_admin`.
- Consumes: `raw.usage_history`, `core.forecast_setting`, `core.policy_config`, `core.item_policy`.

- [ ] **Step 1: 격리 계약 테스트 작성**

테스트는 SQL view 정의가 `train_start/train_end` 및 `test_start/test_end`를 설정 테이블에서 읽고, raw 날짜 literal을 포함하지 않으며, test view가 test 범위 조건을 갖는지 확인한다. 또한 coverage 컬럼명과 admin view의 정책/격리 컬럼을 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test lib/step3-isolation.test.ts`

Expected: view 정의 부재로 FAIL.

- [ ] **Step 3: view 구현**

`v_train_demand`는 `raw.usage_history`와 singleton 설정을 cross join해 `use_date between train_start and train_end`인 행만 반환한다. `v_test_actual`은 동일하게 test 범위만 반환한다. 설정 기간이 null이면 두 view 모두 0행이 되도록 한다.

`analytics.v_data_coverage`는 raw min/max, 설정 네 기간, train/test count, `train_window_ok`, `test_window_ok`, `windows_do_not_overlap`를 반환한다. `analytics.v_forecast_setting_admin`은 기간·granularity·coverage 결과와 `policy_config`, `item_policy` 요약을 관리자 조회용으로 반환한다.

- [ ] **Step 4: view 계약 테스트 통과 확인**

Run: `node --test lib/step3-isolation.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/step3-isolation.test.ts supabase/migrations/20260828000200_step3_data_isolation.sql
git commit -m "STEP3 학습 검증 데이터 격리 view 추가"
```

### Task 3: RLS, grants, 정책 검증 SQL

**Files:**
- Create: `sql/04-step3-verify.sql`
- Modify: `supabase/migrations/20260828000200_step3_data_isolation.sql`

**Interfaces:**
- Produces: raw anon 차단, authenticated view 조회, ADMIN-only config/policy mutation.
- Consumes: STEP 2 `core.is_admin()`과 `core.app_user`.

- [ ] **Step 1: 권한 계약 테스트 작성**

테스트는 migration에 `enable row level security`, `to authenticated` SELECT, `core.is_admin()` mutation 조건, anon privilege revoke가 존재하고 `grant ... to anon` 또는 `using(true)`가 없는지 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `node --test lib/step3-rbac.test.ts`

Expected: test file 부재로 FAIL.

- [ ] **Step 3: RLS와 read-only 검증 SQL 구현**

raw 신규/기존 입력 테이블은 anon의 schema/table 접근과 DML을 revoke하고, authenticated에는 raw 직접 조회 대신 필요한 core/analytics view SELECT만 부여한다. 정책·설정 테이블은 RLS를 켜고 active authenticated SELECT 및 `core.is_admin()` 기반 INSERT/UPDATE/DELETE 정책을 추가한다. `sql/04-step3-verify.sql`은 테이블, view, policy, grant, coverage 컬럼을 조회하는 read-only query만 제공한다.

- [ ] **Step 4: 권한 계약 테스트 통과**

Run: `node --test lib/step3-rbac.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add lib/step3-rbac.test.ts sql/04-step3-verify.sql supabase/migrations/20260828000200_step3_data_isolation.sql
git commit -m "STEP3 정책 설정 RLS와 검증 SQL 추가"
```

### Task 4: 관리자 검증 화면과 문서

**Files:**
- Create: `app/(admin)/admin/forecast-settings/page.tsx`
- Create: `components/admin/forecast-settings-panel.tsx`
- Modify: `lib/menu.ts`, `lib/menu.test.ts`, `styles/components.css`, `README.md`

**Interfaces:**
- Produces: ADMIN-only `/admin/forecast-settings` read-only route.
- Consumes: `requireAdmin()`, `analytics.v_forecast_setting_admin`, STEP 1 UI components, centralized menu.

- [ ] **Step 1: 관리자 메뉴 계약 테스트 작성**

`menuByRole.admin`에 `/admin/forecast-settings`가 있고 USER 메뉴에는 admin 경로가 없음을 확인한다.

- [ ] **Step 2: 실패 확인 후 메뉴 추가**

Run: `node --test lib/menu.test.ts`

Expected: forecast settings menu item 부재로 FAIL 후 메뉴 추가 뒤 PASS.

- [ ] **Step 3: 서버 조회 화면 구현**

page 첫 문장에서 `requireAdmin()`을 호출하고 server client로 analytics view를 조회한다. 전체 기간, train/test 기간, granularity, row count, window 상태, 정책값을 `Panel`, `DataTable`, `Badge`, `EmptyValue`로 표시한다. 조회 오류와 빈 결과를 구분한다.

- [ ] **Step 4: 타입·테스트·build 확인**

Run: `npm test`

Run: `npx tsc --noEmit`

Expected: 모든 테스트 PASS, TypeScript 오류 0건.

- [ ] **Step 5: 커밋**

```bash
git add "app/(admin)/admin/forecast-settings/page.tsx" components/admin/forecast-settings-panel.tsx lib/menu.ts lib/menu.test.ts styles/components.css README.md
git commit -m "관리자 Forecast 설정 검증 화면 추가"
```

### Task 5: 최종 정적 검증과 운영 절차

**Files:**
- Modify: `README.md`

- [ ] **Step 1: leakage와 secret 정적 검사**

Run: `rg -n "raw\.usage_history|from\(['\"]usage_history|sb_secret_|service_role|using\s*\(\s*true|with check\s*\(\s*true" app components lib sql supabase -g '!*.md'`

Expected: Forecast/Demand Profile/Backtest 신규 코드의 raw 직접 조회 0건, secret/service role 0건, unsafe policy 0건.

- [ ] **Step 2: 전체 테스트와 build**

Run: `npm test`

Run: `npm run build`

Expected: 실패 0건, build exit code 0.

- [ ] **Step 3: read-only SQL 검증 및 수동 설정 문서화**

README에 migration 적용, forecast 기간 입력, 정책값 입력, coverage 확인, test 기간 leakage 확인 절차를 기록한다. 원격 Supabase에 migration을 자동 적용하지 않는다.

- [ ] **Step 4: 최종 diff 확인과 커밋**

Run: `git diff --check`

```bash
git add README.md
git commit -m "STEP3 데이터 격리 운영 절차 문서화"
```
