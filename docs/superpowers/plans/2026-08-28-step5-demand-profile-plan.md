# STEP 5 SKU Demand Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학습 구간만 사용해 SKU별 수요 패턴을 SQL에서 계산하고 `/analysis/demand-profile`에서 공통 디자인 시스템으로 조회한다.

**Architecture:** `core.v_train_demand`와 `core.forecast_setting`을 유일한 계산 경계로 삼아 월별 Grid와 통계 지표를 `analytics.v_sku_demand_profile`에서 계산한다. Next.js 서버 조회 계층은 analytics view만 읽고, 모델 정규화 계층은 null/reason code를 보존하며, 화면은 저장된 결과의 필터링과 표시만 담당한다. KPI는 별도 analytics view로 제공해 STEP 6 모델 선택에 사용할 영문 demand type 코드를 유지한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase PostgreSQL, 순수 CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-28-step5-demand-profile-design.md`

## Global Constraints

- Demand Profile 계산은 반드시 `core.v_train_demand`만 사용하며 `raw.usage_history`와 `core.v_test_actual`을 조회하지 않는다.
- 학습/검증 날짜는 TypeScript나 SQL의 고정 날짜가 아니라 `core.forecast_setting`에서 읽는다.
- 통계 계산은 SQL에서 수행하고 React/TypeScript에서는 재계산하지 않는다.
- 계산 불가 값은 null과 reason code를 유지하며 0으로 대체하지 않는다.
- DB demand type 코드는 `SMOOTH`, `INTERMITTENT`, `ERRATIC`, `LUMPY`를 사용하고 한글은 화면에서만 매핑한다.
- Tailwind, styled-components, CSS Modules, 새 차트 라이브러리를 추가하지 않는다.
- 화면은 analytics schema만 조회하고 기존 raw/core 계산 SQL은 불필요하게 변경하지 않는다.
- 변경 후 `npm test`, `npx tsc --noEmit`, `npm run build`, `git diff --check`를 실행한다.

---

### Task 1: SQL Demand Profile 및 KPI View 추가

**Files:**
- Create: `supabase/migrations/20260828000400_step5_demand_profile.sql`
- Test: `lib/step5-demand-profile-schema.test.ts`

**Interfaces:**
- Consumes: `core.v_train_demand`, `core.v_item_master`, `core.forecast_setting`.
- Produces: `analytics.v_sku_demand_profile`, `analytics.v_demand_profile_kpi`, authenticated SELECT grants and anon revokes.

- [ ] **Step 1: Write failing schema-contract tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20260828000400_step5_demand_profile.sql', 'utf8');

test('프로파일 view가 학습 view를 사용하고 raw/test view를 직접 사용하지 않는다', () => {
  assert.match(sql, /core\.v_train_demand/);
  assert.doesNotMatch(sql, /raw\.usage_history/);
  assert.doesNotMatch(sql, /core\.v_test_actual/);
});

test('필수 profile과 KPI 객체 및 demand type 코드가 존재한다', () => {
  assert.match(sql, /analytics\.v_sku_demand_profile/);
  assert.match(sql, /analytics\.v_demand_profile_kpi/);
  for (const code of ['SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY']) assert.match(sql, new RegExp(code));
});
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run: `npm test -- --test-name-pattern="프로파일 view"`

Expected: migration file is missing and the test fails.

- [ ] **Step 3: Write the migration**

Implement these CTE boundaries in the migration:

```sql
-- period_grid: train_start month through train_end month
-- item_grid: core.v_item_master x period_grid
-- period_observation: aggregate core.v_train_demand by item/month
-- profile_stats: ADI, CV/CV², zero rate, trend, recent change, peak
```

The SQL must follow these exact rules:

- Missing Grid periods become `period_qty = 0`; source rows whose quantities are all null remain null and contribute `NULL_QUANTITY`.
- ADI is `n_periods / n_nonzero_periods`; no positive demand returns null and `NO_POSITIVE_DEMAND`.
- CV uses positive-period quantities and `stddev_samp / avg`; fewer than two observations or zero mean returns null with a specific reason.
- Demand type uses only the four Syntetos-Boylan-Croston branches and remains null when ADI or CV² is unavailable.
- Trend uses SQL `regr_slope` over valid monthly observations; fewer than two points returns null.
- Recent change compares the final three Grid months with the preceding three; no prior mean or insufficient windows stays null.
- Peak month uses descending quantity and ascending month so ties choose the earliest month.
- Seasonality is null below 24 months; at 24+ months, require at least two observations for each calendar month and positive overall mean, then use `stddev_samp(month_mean) / avg(month_mean) >= 0.10`.
- `stability` is `STABLE` when CV² `< 0.49`, `VARIABLE` when CV² `>= 0.49`, otherwise null.
- KPI counts null demand types as calculation unavailable and counts `INTERMITTENT + LUMPY` as Croston-needed.
- Use `security_invoker = true` where supported by the existing view convention, grant SELECT to `authenticated`, and revoke SELECT from `anon`.

- [ ] **Step 4: Run the schema tests and verify they pass**

Run: `npm test -- --test-name-pattern="프로파일 view"`

Expected: PASS.

- [ ] **Step 5: Commit the SQL and schema contract**

```bash
git add supabase/migrations/20260828000400_step5_demand_profile.sql lib/step5-demand-profile-schema.test.ts
git commit -m "STEP5 수요 프로파일 SQL 추가"
```

### Task 2: Demand Profile 모델과 서버 조회 계층

**Files:**
- Modify: `lib/scm-model.ts`
- Modify: `lib/scm.ts`
- Test: `lib/scm-demand-profile.test.ts`

**Interfaces:**
- Consumes: analytics view row objects from Supabase.
- Produces: `DemandType`, `DemandProfile`, `DemandProfileKpi`, `normalizeDemandProfile`, `normalizeDemandProfileKpi`, `getDemandProfile`, `getDemandProfileKpi`.

- [ ] **Step 1: Write failing normalization tests**

```ts
test('null 지표와 reason code를 보존한다', () => {
  const row = normalizeDemandProfile({ item_id: 'ITEM001', demand_type: null, adi: null, reason_code: 'NO_POSITIVE_DEMAND' });
  assert.equal(row.adi, null);
  assert.equal(row.demandType, null);
  assert.equal(row.reasonCode, 'NO_POSITIVE_DEMAND');
});

test('영문 demand type 코드만 허용한다', () => {
  assert.equal(normalizeDemandProfile({ demand_type: 'INTERMITTENT' }).demandType, 'INTERMITTENT');
  assert.equal(normalizeDemandProfile({ demand_type: '간헐형' }).demandType, null);
});
```

- [ ] **Step 2: Run the model tests and verify they fail**

Run: `npm test -- --test-name-pattern="demand type 코드\|null 지표"`

Expected: exports are missing and the tests fail.

- [ ] **Step 3: Implement types, normalization, and queries**

Add nullable numeric fields for all SQL metrics, `reasonCode: string | null`, `seasonality: boolean | null`, and exact `DemandType` union. Normalize aliases without turning null into zero. In `lib/scm.ts`, query only:

```ts
supabase.schema('analytics').from('v_sku_demand_profile').select('*')
supabase.schema('analytics').from('v_demand_profile_kpi').select('*').maybeSingle()
```

Return `{ rows, error }` / `{ data, error }` using the existing error handling pattern.

- [ ] **Step 4: Run the model tests and verify they pass**

Run: `npm test -- --test-name-pattern="demand type 코드\|null 지표"`

Expected: PASS.

- [ ] **Step 5: Commit the model and query layer**

```bash
git add lib/scm-model.ts lib/scm.ts lib/scm-demand-profile.test.ts
git commit -m "STEP5 수요 프로파일 조회 계층 추가"
```

### Task 3: Demand Profile 필터와 표 UI

**Files:**
- Create: `components/analysis/demand-profile-filters.tsx`
- Create: `components/analysis/demand-profile-table.tsx`
- Test: `lib/step5-demand-profile-ui.test.ts`

**Interfaces:**
- Consumes: `DemandProfile[]`, `DemandType`, `EmptyValue`, `Badge`, `DataTable`.
- Produces: client-side filtering over already loaded rows; no new calculations or DB calls.

- [ ] **Step 1: Write failing UI contract tests**

```ts
test('필터 UI는 요구된 필터 이름과 DB 코드값을 포함한다', () => {
  const source = readFile('components/analysis/demand-profile-filters.tsx');
  assert.match(source, /Demand Type/);
  assert.match(source, /계산 가능/);
  assert.match(source, /SKU/);
  assert.match(source, /INTERMITTENT/);
});

test('표 UI는 EmptyValue와 공통 Badge를 사용한다', () => {
  const source = readFile('components/analysis/demand-profile-table.tsx');
  assert.match(source, /EmptyValue/);
  assert.match(source, /Badge/);
});
```

- [ ] **Step 2: Run the UI contract tests and verify they fail**

Run: `npm test -- --test-name-pattern="필터 UI\|표 UI"`

Expected: component files are missing and the tests fail.

- [ ] **Step 3: Implement the filter and table**

Make the filters a client component receiving `rows: DemandProfile[]` and returning the subset selected by `demandType`, calculation status, and case-insensitive SKU search. Render ADI, CV², zero-demand rate, trend, seasonality, and recent change as formatted values; render nulls through `EmptyValue` with the row reason code. Render demand type with the existing shared `Badge` and preserve the English code as the badge value or accessible label. Do not calculate any metric in the component.

- [ ] **Step 4: Run the UI contract tests and verify they pass**

Run: `npm test -- --test-name-pattern="필터 UI\|표 UI"`

Expected: PASS.

- [ ] **Step 5: Commit the reusable UI**

```bash
git add components/analysis/demand-profile-filters.tsx components/analysis/demand-profile-table.tsx lib/step5-demand-profile-ui.test.ts
git commit -m "STEP5 수요 프로파일 필터와 표 추가"
```

### Task 4: `/analysis/demand-profile` 페이지 연결

**Files:**
- Create: `app/(user)/analysis/demand-profile/page.tsx`
- Modify: `lib/menu.ts`
- Test: `lib/step5-demand-profile-page.test.ts`

**Interfaces:**
- Consumes: `getDemandProfile()`, `getDemandProfileKpi()`, shared shell/UI components, `DemandProfileTable`.
- Produces: protected user route at `/analysis/demand-profile` and menu entry under Analysis.

- [ ] **Step 1: Write failing page/menu contract tests**

```ts
test('수요 프로파일 route와 메뉴가 존재한다', () => {
  assert.ok(fs.existsSync('app/(user)/analysis/demand-profile/page.tsx'));
  assert.match(fs.readFileSync('lib/menu.ts', 'utf8'), /demand-profile/);
});

test('페이지는 raw usage를 직접 조회하지 않는다', () => {
  const source = fs.readFileSync('app/(user)/analysis/demand-profile/page.tsx', 'utf8');
  assert.doesNotMatch(source, /raw\.usage_history|core\.v_train_demand|core\.v_test_actual/);
});
```

- [ ] **Step 2: Run the page tests and verify they fail**

Run: `npm test -- --test-name-pattern="수요 프로파일 route\|페이지는 raw"`

Expected: page file/menu entry is missing and the tests fail.

- [ ] **Step 3: Implement the server page and menu entry**

Follow the existing leadtime/stockout page pattern. Export `dynamic = 'force-dynamic'`, call both analytics query functions on the server, distinguish query errors from empty rows, show KPI cards for total items and four demand types/Croston/calculation unavailable, and render `DemandProfileTable` with the loaded rows. Add the route to the user analysis menu via `lib/menu.ts`; do not hardcode menu items in the page.

- [ ] **Step 4: Run typecheck and page tests**

Run: `npm test -- --test-name-pattern="수요 프로파일 route\|페이지는 raw"`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: no TypeScript errors.

- [ ] **Step 5: Commit the route integration**

```bash
git add "app/(user)/analysis/demand-profile/page.tsx" lib/menu.ts lib/step5-demand-profile-page.test.ts
git commit -m "STEP5 수요 프로파일 분석 화면 연결"
```

### Task 5: Leakage 회귀 테스트와 전체 검증

**Files:**
- Create: `lib/step5-leakage.test.ts`
- Modify: `error.md` only if a new user-reported error is encountered during verification.

**Interfaces:**
- Consumes: Step 5 SQL, model/query files, page and UI components.
- Produces: regression checks proving only train data is used and all required verification commands pass.

- [ ] **Step 1: Write leakage and null-handling regression tests**

```ts
test('STEP 5 애플리케이션 코드에 raw/test 조회가 없다', () => {
  for (const file of ['lib/scm.ts', 'app/(user)/analysis/demand-profile/page.tsx', 'components/analysis/demand-profile-table.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /raw\.usage_history|core\.v_test_actual/);
  }
});

test('계산 불가 값은 숫자 0으로 대체되지 않는다', () => {
  const source = fs.readFileSync('components/analysis/demand-profile-table.tsx', 'utf8');
  assert.match(source, /EmptyValue/);
  assert.doesNotMatch(source, /\?\? 0/);
});
```

- [ ] **Step 2: Run the focused regression tests**

Run: `npm test -- --test-name-pattern="STEP 5 애플리케이션\|계산 불가 값"`

Expected: PASS.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: all existing and STEP 5 tests pass.

- [ ] **Step 4: Run typecheck and production build**

Run: `npx tsc --noEmit`

Expected: no TypeScript errors.

Run: `npm run build`

Expected: production build succeeds and `/analysis/demand-profile` is included.

- [ ] **Step 5: Check patch hygiene**

Run: `git diff --check`

Expected: no whitespace errors. Review the final diff to confirm no Tailwind/dependency additions, no hardcoded dates in profile code, no direct raw usage reads, and no changes to existing calculation SQL.

- [ ] **Step 6: Commit verification artifacts**

```bash
git add lib/step5-leakage.test.ts
git commit -m "STEP5 데이터 누출 방지 회귀 테스트 추가"
```

After Supabase applies the migration, manually run validation queries for row counts, `<24` seasonality null behavior, exact demand type counts, and profile invariance after inserting a test-period usage row. Record those results in the completion report; do not fabricate remote database results locally.
