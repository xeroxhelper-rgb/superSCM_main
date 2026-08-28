# STEP 10 Safety Stock 및 Purchase Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** STEP 7/9 결과와 정책값을 결합해 SKU별 Safety Stock과 발주추천을 SQL에서 계산하고 화면으로 제공한다.

**Architecture:** 새 SQL migration이 Safety Stock과 Recommendation View를 만들고, Next.js는 analytics View를 조회해 표시한다. 계산불가와 발주불필요는 상태/사유 코드로 분리하며 기존 STEP 7/9 계산 객체는 변경하지 않는다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase PostgreSQL, 순수 CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-28-step10-safety-stock-purchase-design.md`

## Global Constraints

- 계산은 SQL/DB에서 수행하고 React/TypeScript에서 재계산하지 않는다.
- `raw` 테이블을 화면에서 직접 조회하지 않는다.
- null/계산불가를 0 또는 임의 기본값으로 대체하지 않는다.
- Tailwind, styled-components, CSS Modules를 추가하지 않는다.
- Supabase SQL은 migration 파일로만 제공하고 직접 실행하지 않는다.
- 화면 문구와 주석은 한국어로 작성한다.

---

### Task 1: 계산 계약 테스트 작성

**Files:**
- Create: `lib/step10-safety-stock-model.test.ts`
- Create: `lib/step10-safety-stock.test.ts`

- [ ] **Step 1: 실패 테스트 작성**
  - Safety Stock의 sigma_DLT 입력 계약을 검증한다.
  - Forecast/Confirmed Order 우선순위, MOQ, Pack Size, 계산불가 상태를 검증한다.
  - migration이 요구 View와 reason code를 포함하는지 검증한다.

- [ ] **Step 2: 테스트가 기능 부재로 실패하는지 확인**
  - Run: `npm test -- --runInBand`
  - Expected: STEP 10 파일/함수 부재로 실패한다.

### Task 2: Safety Stock 및 Recommendation SQL migration

**Files:**
- Create: `supabase/migrations/20260828000900_step10_safety_stock_purchase.sql`

**Interfaces:**
- Consumes: `analytics.v_stockout_risk`, `analytics.v_inventory_projection`, `analytics.v_leadtime_gap`, `core.item_policy`, `core.policy_config`, STEP 7 model performance/forecast result objects.
- Produces: `analytics.v_safety_stock`, `analytics.v_purchase_recommendation`, `analytics.v_purchase_recommendation_detail`.

- [ ] **Step 1: 정책값과 입력 컬럼 확인**
  - 기존 실제 컬럼을 확인하고 없는 정책 키는 `insert ... on conflict do nothing`으로 추가한다.

- [ ] **Step 2: SQL View 구현**
  - `sigma_DLT`, Safety Stock, Required Qty, MOQ/Pack Size, 추천일을 계산한다.
  - Forecast Error/재고/Lead Time/Policy 누락은 reason code를 반환한다.
  - 계산 trace 컬럼을 모두 결과에 포함한다.

- [ ] **Step 3: 권한 적용**
  - analytics View는 authenticated 조회만 허용하고 정책 변경 객체는 ADMIN RLS를 유지한다.

- [ ] **Step 4: SQL 계약 테스트 통과 확인**
  - Run: `npm test -- --runInBand lib/step10-safety-stock.test.ts`

### Task 3: 모델 타입과 조회 계층

**Files:**
- Modify: `lib/scm-model.ts`
- Modify: `lib/scm.ts`
- Create: `lib/step10-safety-stock-model.ts`

- [ ] **Step 1: 실패 테스트에 맞는 타입/정규화 함수 추가**
  - `SafetyStock`, `PurchaseRecommendation` 타입과 null 보존 normalizer를 추가한다.
  - `getPurchaseRecommendations()`와 `getPurchaseRecommendation(itemId)`를 추가한다.

- [ ] **Step 2: 단위 테스트 통과 확인**
  - Run: `npm test -- --runInBand lib/step10-safety-stock-model.test.ts`

### Task 4: 목록·상세 화면과 메뉴

**Files:**
- Create: `app/(user)/analysis/purchase-recommendation/page.tsx`
- Create: `app/(user)/analysis/purchase-recommendation/[itemId]/page.tsx`
- Create: `components/analysis/purchase-recommendation-table.tsx`
- Modify: `lib/menu.ts`
- Modify: `lib/menu.test.ts`

- [ ] **Step 1: 공통 컴포넌트로 목록 화면 구현**
  - SKU, Item Name, Risk, Forecast, Confirmed Order, Inventory, Safety Stock, Stockout, Required, MOQ, Pack Size, Recommended Qty/Date를 표시한다.

- [ ] **Step 2: 상세 흐름 구현**
  - SQL 결과의 trace 컬럼을 사용해 Forecast → Projection → Safety Stock → Stockout → Recommendation을 표시한다.

- [ ] **Step 3: 화면 계약 테스트 통과 확인**
  - Run: `npm test -- --runInBand lib/step10-pages.test.ts`

### Task 5: 전체 검증

**Files:**
- Modify: `SCHEMA.md`

- [ ] **Step 1: 문서 갱신**
  - 신규 View와 계산불가/발주불필요 상태를 기록한다.

- [ ] **Step 2: 전체 테스트와 타입 검사**
  - Run: `npm test -- --runInBand`
  - Run: `npx tsc --noEmit`

- [ ] **Step 3: 프로덕션 빌드**
  - Run: `npm run build`

- [ ] **Step 4: 공백 및 상태 확인**
  - Run: `git diff --check`
  - Run: `git status --short --branch`
