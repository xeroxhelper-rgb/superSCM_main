# STEP 7 Backtest Champion Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** STEP 6 Forecast Result와 STEP 3 검증 Actual을 SQL로 scoring하여 Model Performance, SKU별 Champion, Model Comparison 화면을 제공한다.

**Architecture:** Backtest는 저장된 forecast 결과와 `core.v_test_actual`만 결합하는 관리자 RPC로 실행한다. 성능·순위·Champion·후보 snapshot은 DB에 저장하고, 화면은 analytics view를 조회해 표시만 하며 toggle은 재실행하지 않는다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase PostgreSQL, 순수 CSS, SVG chart wrapper

**Spec:** `docs/superpowers/specs/2026-08-28-step7-backtest-champion-design.md`

## Global Constraints

- 화면 코드에서 `raw` 스키마를 직접 조회하지 않는다.
- 모든 지표 계산은 SQL 또는 순수 테스트 가능한 모델 함수에서 수행하고 React에서 계산하지 않는다.
- 계산 불가 값은 null과 reason code/status로 보존하며 0으로 대체하지 않는다.
- ADMIN 권한은 Server Action과 DB RPC/RLS에서 모두 검증한다.
- Tailwind, styled-components, CSS Modules, recharts를 추가하지 않는다.
- 한국어 화면 문구·주석·커밋 메시지를 사용한다.

---

### Task 1: Metric and Champion contract tests

**Files:**
- Create: `lib/step7-backtest-model.test.ts`
- Create: `lib/step7-backtest-leakage.test.ts`

**Interfaces:**
- Produces the required static contracts for the SQL, model types, comparison page, and chart wrapper before production implementation.

- [ ] **Step 1: Write failing tests** for WAPE/MAPE/Bias semantics, unavailable reasons, rank/champion rules, required SQL sources, and toggle no-run behavior.
- [ ] **Step 2: Run `npm test lib/step7-backtest-model.test.ts lib/step7-backtest-leakage.test.ts` and verify failure because the STEP 7 files/contracts do not exist.**
- [ ] **Step 3: Keep assertions focused on the eventual public names: `backtest_run`, `model_performance`, `champion_model`, `core.run_backtest`, `core.set_manual_champion`, `analytics.v_model_comparison`, and `ForecastOverlayChart`.**

### Task 2: Backtest schema and SQL scoring

**Files:**
- Create: `supabase/migrations/20260828000600_step7_backtest_champion.sql`

**Interfaces:**
- Consumes: `core.forecast_run`, `core.forecast_result`, `core.model_config`, `core.forecast_setting`, `core.v_test_actual`, `core.is_admin()`, `core.audit_log`.
- Produces: `analytics.backtest_run`, `analytics.model_performance`, `analytics.champion_model`, `core.run_backtest(uuid,text)`, `core.set_manual_champion(text,text,text,text)`, and analytics views for comparison, runs, performance, champions.

- [ ] **Step 1: Add tables with status, calculation status, reason code, metric columns, candidate JSONB, and immutable snapshot fields; add comments documenting formulas and Bias sign.**
- [ ] **Step 2: Add `core.run_backtest` SECURITY DEFINER RPC that selects only stored Forecast Result plus `core.v_test_actual`, calculates all metrics in SQL, ranks valid rows, stores all candidates, and creates AUTO Champion only when valid.**
- [ ] **Step 3: Add `core.set_manual_champion` ADMIN-only RPC requiring nonblank reason, inserting a new MANUAL snapshot and audit record without deleting prior snapshots.**
- [ ] **Step 4: Add RLS/grants so anon cannot read/write, authenticated users can read permitted analytics views, and mutations are function-bound.**
- [ ] **Step 5: Run the static leakage test and inspect the migration for raw usage and forecast re-execution references.**

### Task 3: Model types, queries, and admin actions

**Files:**
- Modify: `lib/scm-model.ts`
- Modify: `lib/scm.ts`
- Create: `lib/backtest-admin.ts`
- Create: `app/(admin)/admin/backtest-runs/actions.ts`
- Create: `app/(admin)/admin/champions/actions.ts`

**Interfaces:**
- Produces: `BacktestRun`, `ModelPerformance`, `ChampionModel`, `ComparisonPoint`, normalizers, `getBacktestRuns()`, `getModelPerformance()`, `getChampions()`, `getModelComparison()`, `runBacktest()`, and `setManualChampion()`.

- [ ] **Step 1: Extend model tests with normalizer cases for null metrics/reason codes.**
- [ ] **Step 2: Run focused tests and verify new type/normalizer failures.**
- [ ] **Step 3: Implement normalization and analytics-only query functions.**
- [ ] **Step 4: Implement `requireAdmin()`-first helpers and Server Actions that call only the corresponding RPCs.**
- [ ] **Step 5: Run TypeScript and focused tests.**

### Task 4: Model Comparison chart wrapper and page

**Files:**
- Create: `components/chart/forecast-overlay-chart.tsx`
- Create: `components/analysis/model-comparison-filters.tsx`
- Create: `components/analysis/model-comparison-table.tsx`
- Create: `app/(user)/analysis/model-comparison/page.tsx`
- Modify: `lib/menu.ts`
- Modify: `styles/chart.css` or `styles/components.css`

**Interfaces:**
- Consumes: `getModelComparison()`, `getModelPerformance()`, `getChampions()`, and `ComparisonPoint[]`.
- Produces: a comparison screen that renders Actual, selected Forecast series, P50/P80/P90 interval, validation shading, metrics, rank, and Champion state without calculating metrics or calling execution actions.

- [ ] **Step 1: Add page contract tests for required filters/table labels and absence of run RPC in client code.**
- [ ] **Step 2: Run page tests to verify they fail before implementation.**
- [ ] **Step 3: Implement a client-only toggle/filter component that changes selected model IDs and rows only.**
- [ ] **Step 4: Implement the SVG chart wrapper using supplied points; do not import recharts or compute metrics.**
- [ ] **Step 5: Implement the server page with explicit query error vs empty result handling and EmptyValue for nulls.**
- [ ] **Step 6: Add the comparison menu item and chart styles, then run focused page tests.**

### Task 5: Admin Backtest and Champion controls

**Files:**
- Create: `app/(admin)/admin/backtest-runs/page.tsx`
- Create: `components/admin/backtest-runs-table.tsx`
- Create: `app/(admin)/admin/champions/page.tsx`
- Create: `components/admin/champions-table.tsx`
- Modify: `lib/menu.ts`

**Interfaces:**
- Consumes: admin query functions and actions from Task 3.
- Produces: ADMIN-only run button, run history, Champion candidate evidence, and manual selection form with required reason.

- [ ] **Step 1: Add page contract tests for ADMIN routes, action names, and required manual reason.**
- [ ] **Step 2: Run tests to verify missing-page failure.**
- [ ] **Step 3: Implement server pages and shared table components using existing design system components.**
- [ ] **Step 4: Implement manual Champion form with hidden item/model values and a required reason input.**
- [ ] **Step 5: Run focused tests and TypeScript.**

### Task 6: Full verification and documentation

**Files:**
- Modify: `error.md` only if an implementation/test error is encountered and resolved.

- [ ] **Step 1: Run `npm test`.**
- [ ] **Step 2: Run `npx tsc --noEmit`.**
- [ ] **Step 3: Run `npm run build`.**
- [ ] **Step 4: Run `git diff --check` and inspect status.**
- [ ] **Step 5: Commit the completed STEP 7 implementation with a Korean commit message.**

