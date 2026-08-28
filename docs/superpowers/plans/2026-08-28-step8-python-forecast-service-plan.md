# STEP 8 Python Forecast Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 별도 FastAPI 배치 서비스에서 Python Forecast를 실행하고 STEP 6/7 저장·비교 구조에 편입한다.

**Architecture:** Python 서비스가 train view를 읽어 forecast run/result를 저장하고, Backtest는 STEP 7 scoring RPC만 호출한다. Next.js는 서버 전용 trigger와 기존 analytics 조회를 담당하며 Python 장애와 저장 결과 조회를 분리한다.

**Tech Stack:** Python 3.11+, FastAPI, pandas, numpy, Supabase Python client, 선택적 statsmodels/Prophet/XGBoost, Next.js 15, TypeScript

**Spec:** `docs/superpowers/specs/2026-08-28-step8-python-forecast-service-design.md`

## Global Constraints

- Forecast 학습 데이터는 `core.v_train_demand`만 사용한다.
- `core.v_test_actual`은 Python Forecast 학습에 사용하지 않는다.
- 저장 키 `run_id`, `model_version`, `item_id`, `period`를 유지한다.
- service role key는 Python 서버 환경변수에만 저장하고 브라우저/Next public env에 노출하지 않는다.
- 모든 모델은 `forecast(train_df, horizon, params) -> DataFrame` 인터페이스를 따른다.
- 선택 의존성 누락은 모델 단위 unavailable로 처리한다.
- UI/Next.js에서는 Forecast 계산을 하지 않는다.

---

### Task 1: Python service contracts and tests

**Files:**
- Create: `services/forecast-python/app/models/base.py`
- Create: `services/forecast-python/app/models/builtin.py`
- Create: `services/forecast-python/app/models/registry.py`
- Create: `services/forecast-python/tests/test_models.py`
- Create: `services/forecast-python/requirements.txt`
- Create: `services/forecast-python/README.md`

- [ ] Write failing tests for common DataFrame output, smooth and intermittent model IDs, null-safe horizon, and optional dependency unavailable behavior.
- [ ] Run `python -m unittest discover services/forecast-python/tests` and verify expected failures.
- [ ] Implement base protocol, built-in adapters, registry, and dependency adapters with lazy imports.
- [ ] Run Python tests and verify all model contract tests pass.

### Task 2: Python Supabase repository and API

**Files:**
- Create: `services/forecast-python/app/config.py`
- Create: `services/forecast-python/app/repository.py`
- Create: `services/forecast-python/app/service.py`
- Create: `services/forecast-python/app/main.py`
- Create: `services/forecast-python/tests/test_api.py`
- Create: `services/forecast-python/Dockerfile`

- [ ] Write failing tests for health/models endpoints, forecast input validation, test-view exclusion, successful save, and failed run status.
- [ ] Run focused Python tests and verify failures.
- [ ] Implement repository methods using server-only env configuration, Forecast run/result snapshots, and STEP 7 backtest RPC.
- [ ] Implement FastAPI endpoints with stable response envelopes and error handling.
- [ ] Run Python tests without requiring a live Supabase connection by injecting a repository fake.

### Task 3: DB Python registry migration

**Files:**
- Create: `supabase/migrations/20260828000700_step8_python_forecast.sql`
- Create: `lib/step8-python-service.test.ts`

- [ ] Add a failing static test for PYTHON engine, model registry IDs, train-only source, and result columns.
- [ ] Implement migration to relax engine check, seed Python model configs, add grants/constraints, and preserve STEP 6 SQL behavior.
- [ ] Verify migration contains no test Actual source in Forecast execution and no public/service key references.

### Task 4: Next.js server trigger and model visibility

**Files:**
- Create: `lib/python-forecast-admin.ts`
- Create: `app/(admin)/admin/python-forecast/actions.ts`
- Create: `app/(admin)/admin/python-forecast/page.tsx`
- Create: `components/admin/python-forecast-panel.tsx`
- Modify: `lib/menu.ts`
- Create: `lib/step8-next.test.ts`

- [ ] Write failing tests for requireAdmin-first server action, server-only service URL, model visibility, and no client secret.
- [ ] Implement server helper using internal URL/token env values and timeout/failure messages without changing analytics reads.
- [ ] Add ADMIN page for model selection and Python run trigger.
- [ ] Add menu item and run TypeScript/tests.

### Task 5: Full verification and commit

- [ ] Run Python unit tests.
- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`, inspect status, and commit in Korean.
- [ ] Report that Supabase migration and Python environment variables still require manual setup.
