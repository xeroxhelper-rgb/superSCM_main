# STEP 6 Forecast Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학습 구간 기반 SQL Baseline Forecast를 실행하고 모델 정의·버전·run·result·stale 상태를 재현 가능하게 저장한다.

**Architecture:** DB migration이 모델 레지스트리, 버전 snapshot, forecast run/result, 실행 RPC, analytics view와 RLS를 한 경계로 제공한다. 오케스트레이터 함수는 `core.v_train_demand` 기반 월별 grid만 사용해 enabled 모델을 계산하고 새 run_id로 결과를 보존한다. Next.js는 analytics view 조회와 ADMIN 전용 실행/설정 화면만 담당하며 Forecast 수학을 재계산하지 않는다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase PostgreSQL, 순수 CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-28-step6-forecast-engine-design.md`

## Global Constraints

- Forecast 계산의 유일한 입력은 `core.v_train_demand`에서 만든 월별 train grid다.
- `raw.usage_history`, `core.v_test_actual`, test 기간 actual을 Forecast 계산에서 직접 사용하지 않는다.
- Forecast setting의 경계와 horizon을 코드에 날짜 리터럴로 고정하지 않는다.
- 계산 불가 값은 null 또는 결과 행 미생성으로 처리하고 0으로 치환하지 않는다.
- 모델 코드는 `SMOOTH`, `INTERMITTENT`, `ERRATIC`, `LUMPY` 영문 코드와 DB parameters를 사용한다.
- React에서는 이동평균, WMA, residual sigma, P80/P90을 계산하지 않는다.
- 과거 Forecast 결과를 update/delete하지 않고 모든 결과는 run_id와 model_version을 가진다.
- ADMIN 권한은 서버 helper와 DB/RPC에서 검증하고 메뉴 숨김만 보안 수단으로 사용하지 않는다.
- 사용자가 Supabase SQL Editor에서 migration을 실행하므로 원격 DB를 로컬 도구로 조작하지 않는다.
- 변경 후 `npm test`, `npx tsc --noEmit`, `npm run build`, `git diff --check`를 실행한다.

---

### Task 1: Model Registry와 Forecast 저장 모델

**Files:**
- Create: `supabase/migrations/20260828000500_step6_forecast_engine.sql`
- Test: `lib/step6-forecast-schema.test.ts`

**Interfaces:**
- Consumes: `core.forecast_setting`, `core.v_train_demand`, STEP 5 demand type/profile.
- Produces: `core.model_config`, `core.model_version`, `core.forecast_run`, `core.forecast_result` and constraints/indexes.

- [ ] **Step 1: Write failing schema contract tests**

```ts
test('Forecast migration은 registry/version/run/result 객체를 정의한다', () => {
  const sql = readMigration();
  for (const object of ['core.model_config', 'core.model_version', 'core.forecast_run', 'core.forecast_result']) assert.match(sql, new RegExp(object.replace('.', '\\.'), 'i'));
  for (const column of ['model_id', 'model_version', 'predicted_qty', 'p50', 'p80', 'p90', 'sigma', 'data_snapshot_at', 'triggered_by']) assert.match(sql, new RegExp(column, 'i'));
});

test('Forecast SQL은 train view만 사용하고 test/raw 직접 조회를 금지한다', () => {
  const sql = readMigration();
  assert.match(sql, /core\.v_train_demand/);
  assert.doesNotMatch(sql, /raw\.usage_history/);
  assert.doesNotMatch(sql, /core\.v_test_actual/);
});
```

- [ ] **Step 2: Run the schema tests and verify they fail**

Run: `npm test -- --test-name-pattern="registry/version/run/result"`

Expected: migration file is missing and tests fail.

- [ ] **Step 3: Create tables, checks, defaults, and initial model rows**

Define JSONB parameters and text-array applicable demand types. Add status check `RUNNING/SUCCESS/FAILED`, composite result PK, FKs from version/run/result, nonnegative horizon/count checks, and indexes for run/model/item/period lookup. Register the five models from the spec with WMA parameters representing recent weights `3:2:1`; do not hardcode parameters in application code.

Enable RLS, revoke anon access, grant authenticated SELECT where required, and permit only the later ADMIN RPC path to mutate registry/run/result data.

- [ ] **Step 4: Run the schema tests and verify they pass**

Run: `npm test -- --test-name-pattern="registry/version/run/result"`

Expected: PASS.

- [ ] **Step 5: Commit the storage schema**

```bash
git add supabase/migrations/20260828000500_step6_forecast_engine.sql lib/step6-forecast-schema.test.ts
git commit -m "STEP6 Forecast 저장 모델 추가"
```

### Task 2: SQL Baseline 계산과 실행 RPC

**Files:**
- Modify: `supabase/migrations/20260828000500_step6_forecast_engine.sql`
- Test: `lib/step6-forecast-calculation.test.ts`

**Interfaces:**
- Consumes: model registry rows, model parameters, `core.v_train_demand`, `core.forecast_setting`, `analytics.v_sku_demand_profile`.
- Produces: `core.run_baseline_forecast()` with run_id return value and persisted snapshots/results.

- [ ] **Step 1: Write failing SQL contract tests**

```ts
test('Baseline 모델과 실행 함수가 요구된 계산 계약을 포함한다', () => {
  const sql = readMigration();
  for (const model of ['MA_3M', 'MA_6M', 'WMA_3M', 'PY_SAME_MONTH', 'SEASONAL_NAIVE']) assert.match(sql, new RegExp(model));
  assert.match(sql, /run_baseline_forecast/);
  assert.match(sql, /stddev_samp/);
  assert.match(sql, /0\.841621/);
  assert.match(sql, /1\.281552/);
});

test('모델 계산은 부족한 이력을 0으로 보정하지 않는다', () => {
  const sql = readMigration();
  assert.match(sql, /INSUFFICIENT_HISTORY/);
  assert.match(sql, /NULL_TRAIN_INPUT/);
  assert.doesNotMatch(sql, /coalesce\([^\n]*predicted_qty[^\n]*,\s*0\)/i);
});
```

- [ ] **Step 2: Run the calculation tests and verify they fail**

Run: `npm test -- --test-name-pattern="Baseline 모델|부족한 이력"`

Expected: execution function and calculation markers are missing.

- [ ] **Step 3: Implement deterministic train grid and fitted residual CTEs**

Build one monthly grid from configured train dates. For each enabled SQL model calculate:

```sql
MA_3M       = avg(previous 3 months)
MA_6M       = avg(previous 6 months)
WMA_3M      = (oldest * 1 + middle * 2 + recent * 3) / 6
PY_SAME_MONTH = quantity at lag 12 months
SEASONAL_NAIVE = quantity at parameters.lag_months
```

Only complete windows produce point forecasts. Generate future months starting at `train_end` plus one month for `forecast_horizon` months. Use one-step-ahead fitted values inside the train window, calculate `residual = actual - fitted`, and use `stddev_samp(residual)` per item/model as sigma. Store null p80/p90 whenever sigma is null; store reason codes instead of fabricated values.

- [ ] **Step 4: Implement the SECURITY DEFINER orchestrator**

The function must call `core.is_admin()`, read settings/models, insert model_version snapshots, insert a RUNNING row, insert all result rows with run_id/model_version, update counts and SUCCESS, and catch exceptions to update FAILED/message before re-raising. Capture `triggered_by` and `triggered_email` from `auth.uid()`/JWT claims. Ensure model applicability is checked against exact STEP 5 demand type codes.

- [ ] **Step 5: Run the calculation tests and verify they pass**

Run: `npm test -- --test-name-pattern="Baseline 모델|부족한 이력"`

Expected: PASS.

- [ ] **Step 6: Commit the SQL execution engine**

```bash
git add supabase/migrations/20260828000500_step6_forecast_engine.sql lib/step6-forecast-calculation.test.ts
git commit -m "STEP6 SQL Baseline 실행 함수 추가"
```

### Task 3: Stale 판정과 Analytics View

**Files:**
- Modify: `supabase/migrations/20260828000500_step6_forecast_engine.sql`
- Test: `lib/step6-forecast-analytics.test.ts`

**Interfaces:**
- Consumes: core model/run/result tables and train source metadata.
- Produces: `analytics.v_model_config`, `analytics.v_forecast_run`, `analytics.v_forecast_result`, `analytics.v_forecast_run_kpi`.

- [ ] **Step 1: Write failing analytics contract tests**

```ts
test('Forecast analytics view와 stale 필드를 정의한다', () => {
  const sql = readMigration();
  for (const view of ['analytics.v_model_config', 'analytics.v_forecast_run', 'analytics.v_forecast_result', 'analytics.v_forecast_run_kpi']) assert.match(sql, new RegExp(view.replace('.', '\\.'), 'i'));
  assert.match(sql, /is_stale/);
  assert.match(sql, /data_snapshot_at/);
});
```

- [ ] **Step 2: Run the analytics tests and verify they fail**

Run: `npm test -- --test-name-pattern="Forecast analytics view"`

Expected: view definitions are missing.

- [ ] **Step 3: Implement analytics views and grants**

Expose only screen fields. Join run/result to model version for readable snapshot data. Calculate `is_stale` by comparing the run snapshot with the maximum train-source `loaded_at` and return `stale_reason` when comparison is unavailable. Never delete old runs/results. Grant authenticated SELECT and revoke anon SELECT.

- [ ] **Step 4: Run analytics tests and commit**

Run: `npm test -- --test-name-pattern="Forecast analytics view"`

Expected: PASS.

```bash
git add supabase/migrations/20260828000500_step6_forecast_engine.sql lib/step6-forecast-analytics.test.ts
git commit -m "STEP6 Forecast analytics view 추가"
```

### Task 4: 서버 조회 모델과 ADMIN actions

**Files:**
- Modify: `lib/scm-model.ts`
- Modify: `lib/scm.ts`
- Create: `lib/forecast-admin.ts`
- Create: `app/(admin)/admin/forecast-models/actions.ts`
- Create: `app/(admin)/admin/forecast-runs/actions.ts`
- Test: `lib/step6-forecast-admin.test.ts`

**Interfaces:**
- Consumes: `analytics.v_model_config`, `analytics.v_forecast_run`, `analytics.v_forecast_result`, `core.run_baseline_forecast()`.
- Produces: `ForecastModel`, `ForecastRun`, `ForecastResult`, `getForecastModels()`, `getForecastRuns()`, `getForecastResult()`, ADMIN-only mutation/execute actions.

- [ ] **Step 1: Write failing auth/query boundary tests**

```ts
test('Forecast 관리자 action은 requireAdmin과 RPC 경계를 사용한다', () => {
  for (const file of ['app/(admin)/admin/forecast-models/actions.ts', 'app/(admin)/admin/forecast-runs/actions.ts']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /requireAdmin/);
  }
  assert.match(fs.readFileSync('app/(admin)/admin/forecast-runs/actions.ts', 'utf8'), /run_baseline_forecast/);
});
```

- [ ] **Step 2: Run the boundary tests and verify they fail**

Run: `npm test -- --test-name-pattern="Forecast 관리자 action"`

Expected: action files and types are missing.

- [ ] **Step 3: Implement nullable forecast models and analytics-only queries**

Add exact unions for model family/engine/status where stable, preserve JSON parameters and model version, and normalize every nullable metric without `?? 0`. Query only analytics schema for display. The execute action calls `requireAdmin()` then invokes the RPC; model updates validate parameters as JSON and never run from the browser client.

- [ ] **Step 4: Run tests and commit the server boundary**

Run: `npm test -- --test-name-pattern="Forecast 관리자 action"`

Expected: PASS.

```bash
git add lib/scm-model.ts lib/scm.ts lib/forecast-admin.ts "app/(admin)/admin/forecast-models/actions.ts" "app/(admin)/admin/forecast-runs/actions.ts" lib/step6-forecast-admin.test.ts
git commit -m "STEP6 Forecast 관리자 서버 경계 추가"
```

### Task 5: ADMIN Forecast Models/Runs 화면과 메뉴

**Files:**
- Create: `components/admin/forecast-models-table.tsx`
- Create: `components/admin/forecast-runs-table.tsx`
- Create: `app/(admin)/admin/forecast-models/page.tsx`
- Create: `app/(admin)/admin/forecast-runs/page.tsx`
- Modify: `lib/menu.ts`
- Test: `lib/step6-forecast-pages.test.ts`

**Interfaces:**
- Consumes: server query functions, ADMIN actions, shared `PageHeader`, `Panel`, `Badge`, `DataTable`, `EmptyValue`.
- Produces: protected `/admin/forecast-models` and `/admin/forecast-runs` pages; screen-only filters over stored rows.

- [ ] **Step 1: Write failing route/menu tests**

```ts
test('Forecast 관리자 route와 메뉴가 존재한다', () => {
  assert.ok(fs.existsSync('app/(admin)/admin/forecast-models/page.tsx'));
  assert.ok(fs.existsSync('app/(admin)/admin/forecast-runs/page.tsx'));
  const menu = fs.readFileSync('lib/menu.ts', 'utf8');
  assert.match(menu, /forecast-models/);
  assert.match(menu, /forecast-runs/);
});
```

- [ ] **Step 2: Run the page tests and verify they fail**

Run: `npm test -- --test-name-pattern="Forecast 관리자 route"`

Expected: routes/menu entries are missing.

- [ ] **Step 3: Implement server-rendered admin pages and reusable tables**

Use `dynamic = 'force-dynamic'`, distinguish query errors from empty data, and display model name/family/engine/version/enabled/applicable demand type/parameters. Runs display run_id/status/runtime/model count/SKU count/result rows/snapshot/stale/triggered_by. Buttons submit to server actions; no forecast math or automatic execution during page load.

- [ ] **Step 4: Run typecheck/page tests and commit**

Run: `npm test -- --test-name-pattern="Forecast 관리자 route"`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: no TypeScript errors.

```bash
git add components/admin/forecast-models-table.tsx components/admin/forecast-runs-table.tsx "app/(admin)/admin/forecast-models/page.tsx" "app/(admin)/admin/forecast-runs/page.tsx" lib/menu.ts lib/step6-forecast-pages.test.ts
git commit -m "STEP6 Forecast 관리자 화면 추가"
```

### Task 6: Leakage/재현성 회귀 테스트와 최종 검증

**Files:**
- Create: `lib/step6-forecast-leakage.test.ts`
- Modify: `error.md` only if a new user-reported error occurs.

**Interfaces:**
- Consumes: all Step 6 SQL, server, and page files.
- Produces: automated static safeguards and final verification evidence.

- [ ] **Step 1: Write leakage regression tests**

```ts
test('Forecast 앱 코드에 raw/test 직접 조회가 없다', () => {
  for (const file of ['lib/forecast-admin.ts', 'app/(admin)/admin/forecast-models/page.tsx', 'app/(admin)/admin/forecast-runs/page.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /raw\.usage_history|core\.v_test_actual/);
  }
});

test('Forecast 결과 저장 경계는 run_id와 model_version을 요구한다', () => {
  const sql = fs.readFileSync('supabase/migrations/20260828000500_step6_forecast_engine.sql', 'utf8');
  assert.match(sql, /run_id[\s\S]*model_version/);
  assert.match(sql, /p80[\s\S]*sigma/);
});
```

- [ ] **Step 2: Run regression tests and verify they pass**

Run: `npm test -- --test-name-pattern="Forecast 앱 코드|Forecast 결과 저장"`

Expected: PASS.

- [ ] **Step 3: Run the complete local verification**

Run: `npm test`

Expected: all existing and STEP 6 tests pass.

Run: `npx tsc --noEmit`

Expected: no TypeScript errors.

Run: `npm run build`

Expected: production build succeeds.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Commit regression tests**

```bash
git add lib/step6-forecast-leakage.test.ts
git commit -m "STEP6 Forecast 누출 방지 회귀 테스트 추가"
```

After the user applies the migration in Supabase SQL Editor, manually validate: ADMIN-only model toggle, successful run and model snapshots, insufficient-history nulls, sigma interval nulls, FAILED run creation, stale after new train data, unchanged results after test-only changes, and deterministic rerun under the same snapshot/definition. Report remote SQL results only after the user provides them.
