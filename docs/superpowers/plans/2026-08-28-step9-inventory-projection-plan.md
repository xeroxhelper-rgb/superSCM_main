# STEP 9 Inventory Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** STEP 7 Champion Forecast와 재고·입고·확정수주·가예약·Effective Lead Time을 결합한 SQL Inventory Projection 및 새 Stockout Risk 화면을 구현한다.

**Architecture:** PostgreSQL migration이 모든 Projection, Effective Lead Time, Risk, KPI를 계산하고 analytics View로 노출한다. Next.js는 `lib/scm.ts`의 조회 함수와 공통 UI로 결과를 렌더링하며, Lead Time 변경은 ADMIN Server Action에서 SECURITY DEFINER RPC를 호출한다. 기존 `/analysis/stockout` 경로는 유지하고 레거시 Workflow 코드는 수정하지 않는다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, 순수 CSS, Supabase PostgreSQL, `@supabase/ssr`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-28-step9-inventory-projection-design.md`

## Global Constraints

- Supabase 원본 데이터는 `raw` 스키마에서 직접 수정하지 않는다.
- 화면은 `analytics` View를 조회하고 계산식은 SQL에서 수행한다.
- Tailwind, styled-components, CSS Modules와 새 차트 라이브러리를 추가하지 않는다.
- 계산 불가 값은 0, 기본 30일, 임의 날짜로 대체하지 않고 null과 reason code를 유지한다.
- 사용자 권한은 서버와 DB에서 모두 확인하며 Lead Time mutation은 ADMIN만 가능하다.
- 화면 문구·주석·커밋 메시지는 한국어로 작성하고 DB 코드값은 영어 대문자를 사용한다.
- 기존 raw 테이블과 analytics View를 drop/recreate하지 않고 `create or replace view`와 `alter table ... if not exists`를 사용한다.

### Task 1: 실패하는 STEP 9 DB·계산 계약 테스트 작성

**Files:**
- Create: `lib/step9-inventory-projection.test.ts`
- Create: `lib/step9-inventory-projection-model.test.ts`

**Interfaces:**
- Produces: SQL 객체명, 상태 코드, 계산 계약을 고정하는 테스트. 이후 migration과 UI 작업은 이 계약을 통과해야 한다.

- [ ] **Step 1: SQL 계약 테스트를 작성한다**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sql = readFileSync(new URL('../supabase/migrations/20260828000800_step9_inventory_projection.sql', import.meta.url), 'utf8');

test('STEP 9 migration은 Projection·Lead Time·Risk 객체를 정의한다', () => {
  for (const objectName of ['leadtime_policy_history', 'v_effective_lead_time', 'v_inventory_projection', 'v_stockout_risk', 'v_stockout_kpi', 'v_leadtime_policy']) {
    assert.match(sql, new RegExp(objectName));
  }
});

test('STEP 9 SQL은 Forecast·재고·입고·수주·가예약을 결합한다', () => {
  for (const source of ['v_forecast_result', 'champion_model', 'inventory', 'purchase_order', 'sales_order', 'business_event']) assert.match(sql, new RegExp(source, 'i'));
  assert.match(sql, /scheduled_receipt|scheduled_receipts/i);
  assert.match(sql, /soft_allocation/i);
});

test('계산 불가 원인과 Risk 상태를 숫자 대체 없이 정의한다', () => {
  for (const reason of ['NO_INVENTORY_DATA', 'NO_FORECAST', 'NO_LEADTIME', 'INSUFFICIENT_SAMPLE']) assert.match(sql, new RegExp(reason));
  for (const status of ['SAFE', 'WARNING', 'CRITICAL', 'CALCULATION_UNAVAILABLE']) assert.match(sql, new RegExp(status));
  assert.match(sql, /planned_lead_time.*p80|p80.*planned_lead_time/is);
});
```

- [ ] **Step 2: 순수 Projection 상태 계산 테스트를 작성한다**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyProjectionRisk } from './step9-inventory-projection-model.ts';

test('재고가 충분하면 SAFE를 반환한다', () => assert.equal(classifyProjectionRisk({ stockoutPeriod: null, leadTimeDays: 20, stockoutLeadDays: null }), 'SAFE'));
test('Lead Time 안에 소진되고 입고 전 대응 가능하면 WARNING이다', () => assert.equal(classifyProjectionRisk({ stockoutPeriod: '2026-09-20', leadTimeDays: 30, stockoutLeadDays: 20 }), 'WARNING'));
test('예상 입고보다 먼저 소진되면 CRITICAL이다', () => assert.equal(classifyProjectionRisk({ stockoutPeriod: '2026-09-10', leadTimeDays: 30, stockoutLeadDays: 10 }), 'CRITICAL'));
test('필수 값이 없으면 계산 불가 상태다', () => assert.equal(classifyProjectionRisk({ stockoutPeriod: null, leadTimeDays: null, stockoutLeadDays: null }), 'CALCULATION_UNAVAILABLE'));
```

- [ ] **Step 3: 테스트를 실행해 migration·모델이 없어 실패하는지 확인한다**

Run: `node --test lib/step9-inventory-projection.test.ts lib/step9-inventory-projection-model.test.ts`

Expected: migration 파일과 `classifyProjectionRisk`가 아직 없어 실패한다.

### Task 2: Projection 순수 모델 구현

**Files:**
- Create: `lib/step9-inventory-projection-model.ts`
- Modify: `lib/step9-inventory-projection-model.test.ts`

**Interfaces:**
- Consumes: `{ stockoutPeriod: string | null; leadTimeDays: number | null; stockoutLeadDays: number | null }`.
- Produces: `classifyProjectionRisk(input): 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE'`.

- [ ] **Step 1: 테스트가 요구하는 최소 타입과 함수를 구현한다**

```ts
export type ProjectionRiskStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE';
export type ProjectionRiskInput = { stockoutPeriod: string | null; leadTimeDays: number | null; stockoutLeadDays: number | null };

export function classifyProjectionRisk(input: ProjectionRiskInput): ProjectionRiskStatus {
  if (input.leadTimeDays === null || (input.stockoutPeriod !== null && input.stockoutLeadDays === null)) return 'CALCULATION_UNAVAILABLE';
  if (input.stockoutPeriod === null) return 'SAFE';
  return input.stockoutLeadDays! <= input.leadTimeDays ? 'WARNING' : 'CRITICAL';
}
```

- [ ] **Step 2: 모델 테스트가 통과하는지 확인한다**

Run: `node --test lib/step9-inventory-projection-model.test.ts`

Expected: 4 tests pass.

### Task 3: STEP 9 SQL migration 작성

**Files:**
- Create: `supabase/migrations/20260828000800_step9_inventory_projection.sql`
- Modify: `lib/step9-inventory-projection.test.ts`

**Interfaces:**
- Consumes: STEP 3~7의 `core.forecast_setting`, `core.leadtime_plan`, `core.v_leadtime_effective`, `core.forecast_result`, `core.champion_model`, 그리고 적재된 raw 입력 테이블.
- Produces: `core.leadtime_policy_history`, `core.v_effective_lead_time`, `core.v_inventory_projection`, `analytics.v_inventory_projection`, `analytics.v_stockout_risk`, `analytics.v_stockout_kpi`, `analytics.v_leadtime_policy`, `core.admin_set_leadtime`.

- [ ] **Step 1: Lead Time 이력 테이블과 설정 정책을 추가한다**

`core.leadtime_policy_history`는 `supplier_id`, `previous_lead_time`, `next_lead_time`, `effective_from`, `changed_by`, `reason`, `changed_at`을 저장하고 append-only 권한으로 구성한다. `core.policy_config`에 `CONFIRMED_ORDER_DEMAND_MODE = ADDITIVE_COMMITTED`를 upsert한다.

- [ ] **Step 2: Effective Lead Time View를 추가한다**

`core.v_effective_lead_time`에서 `core.leadtime_plan.planned_lead_time`이 null이 아니면 `source = 'ADMIN_CONFIRMED'`로 선택하고, 그렇지 않으면 `core.v_leadtime_effective`의 P80을 `source = 'ACTUAL_P80'`으로 선택한다. 둘 다 없으면 `effective_lead_time = null`, `reason_code = 'NO_LEADTIME'`을 반환한다.

- [ ] **Step 3: 입력 어댑터와 기간별 Projection View를 추가한다**

입력 컬럼은 현재 import schema의 표준 컬럼을 사용한다.

```sql
raw.inventory(품목코드, 현재고, 기준일자)
raw.purchase_order(품목코드, 발주수량, 납기예정일)
raw.sales_order(item_id, quantity, requested_date, status)
raw.business_event(event_type, event_date, item_id, quantity)
```

Forecast period와 item별 Champion 결과를 기준으로 시작 재고를 한 번만 적용하고, 해당 기간의 Open PO·확정수주·Soft Allocation·Forecast를 각각 집계한다. Open PO는 예정일이 period에 속할 때만 더하고, 모든 차감은 `coalesce(..., 0)`가 아니라 source row의 존재 상태를 별도 컬럼으로 보존한다. 시작 재고 row가 없거나 Champion Forecast가 없으면 해당 행의 ending 값과 Risk를 계산 불가로 둔다.

- [ ] **Step 4: Stockout/Risk/KPI View를 Projection 기반으로 교체한다**

Projection의 최초 `ending_projected_inventory <= 0` period를 `stockout_period`로 선택한다. Forecast horizon 안에 소진이 없으면 stockout period는 null이다. `days_of_supply`는 첫 소진 period까지의 일수 또는 전체 horizon 내 수요가 없을 때 null로 두며, Risk는 `SAFE`, `WARNING`, `CRITICAL`, `CALCULATION_UNAVAILABLE`만 사용한다.

- [ ] **Step 5: ADMIN RPC, RLS, grants를 추가한다**

`core.admin_set_leadtime(p_supplier_id text, p_next_lead_time integer, p_effective_from date, p_reason text)`는 `core.is_admin()`을 먼저 확인하고, reason 누락·음수 Lead Time·대상 공급처 누락을 거부한다. 기존값을 이력과 `core.audit_log`에 기록한 후 `core.leadtime_plan`을 갱신한다. anon mutation은 revoke하고 authenticated 조회 및 ADMIN mutation 정책을 적용한다.

- [ ] **Step 6: SQL 계약 테스트를 통과시킨다**

Run: `node --test lib/step9-inventory-projection.test.ts`

Expected: 객체·source·상태·권한 계약 테스트 pass.

### Task 4: TypeScript 조회 모델과 repository 연결

**Files:**
- Modify: `lib/scm-model.ts`
- Modify: `lib/scm.ts`
- Create: `lib/step9-model.test.ts`

**Interfaces:**
- Produces: `InventoryProjection`, `LeadtimePolicy` 타입, `normalizeInventoryProjection`, `normalizeLeadtimePolicy`, `getInventoryProjection`, `getLeadtimePolicy`.

- [ ] **Step 1: null과 reason code를 보존하는 정규화 테스트를 작성한다**

```ts
test('Projection 정규화는 null과 reason code를 숫자로 바꾸지 않는다', () => {
  const row = normalizeInventoryProjection({ item_id: 'ITEM001', ending_projected_inventory: null, risk_status: 'CALCULATION_UNAVAILABLE', reason_code: 'NO_FORECAST' });
  assert.equal(row.endingProjectedInventory, null);
  assert.equal(row.reasonCode, 'NO_FORECAST');
});
```

- [ ] **Step 2: 타입과 정규화 함수를 구현한다**

`InventoryProjection`은 `period`, `beginningInventory`, `scheduledReceipt`, `confirmedSalesOrder`, `softAllocation`, `forecastDemand`, `endingProjectedInventory`, `stockoutPeriod`, `daysOfSupply`, `monthsOfSupply`, `riskStatus`, `reasonCode`를 포함하고 nullable 수치를 그대로 유지한다.

- [ ] **Step 3: analytics 조회 함수를 구현한다**

`getInventoryProjection(filters?: { itemId?: string; from?: string; to?: string })`는 `analytics.v_inventory_projection`만 조회한다. `getLeadtimePolicy()`는 `analytics.v_leadtime_policy`와 `analytics.v_leadtime_policy_history`를 직접 raw 조회 없이 사용한다.

- [ ] **Step 4: 테스트와 타입 검사를 실행한다**

Run: `node --test lib/step9-model.test.ts`; `npx tsc --noEmit`

Expected: pass.

### Task 5: Stockout 화면 교체 및 Inventory Projection 화면 추가

**Files:**
- Modify: `app/(user)/analysis/stockout/page.tsx`
- Create: `app/(user)/analysis/inventory-projection/page.tsx`
- Create: `components/analysis/inventory-projection-table.tsx`
- Modify: `lib/step9-pages.test.ts`
- Modify: `lib/menu.ts`

**Interfaces:**
- Consumes: `getStockoutRisk`, `getStockoutKpi`, `getInventoryProjection`의 저장된 analytics 결과.
- Produces: `/analysis/stockout` Projection 기반 표, `/analysis/inventory-projection` 기간별 표, USER 메뉴 링크.

- [ ] **Step 1: 페이지 계약 테스트를 작성한다**

페이지는 `analytics.v_stockout_risk`, `analytics.v_inventory_projection`을 직접 import하지 않고 `lib/scm.ts` 조회 함수를 사용해야 하며, `EmptyValue`와 공통 `Badge`를 사용해야 한다.

- [ ] **Step 2: Stockout 표를 새 컬럼 계약으로 교체한다**

기존 `dailyUsageAvg` 표시와 average usage 기반 설명을 제거하고 Projection 기반 `endingProjectedInventory`, `stockoutPeriod`, `daysOfSupply`, `riskStatus`, `reasonCode`를 표시한다. 계산 불가 값은 `<EmptyValue reason={...} />`로 표현한다.

- [ ] **Step 3: Inventory Projection 페이지와 테이블을 구현한다**

기간·SKU 필터는 저장된 행 조회 조건만 변경한다. 합계·누적·Risk 계산을 React에서 수행하지 않는다. 컬럼은 Period, Beginning Inventory, Scheduled Receipt, Confirmed Sales Order, Soft Allocation, Forecast Demand, Ending Projected Inventory, Stockout Period, Days of Supply, Risk Status, Reason Code 순서로 표시한다.

- [ ] **Step 4: 메뉴를 연결하고 페이지 계약 테스트를 통과시킨다**

USER `ANALYSIS`에 `/analysis/inventory-projection`을 추가하고 ADMIN `SCM POLICIES`에 `/admin/scm-policies/leadtime`를 추가할 준비를 한다.

Run: `node --test lib/step9-pages.test.ts`

Expected: route·공통 UI·조회 경계 테스트 pass.

### Task 6: ADMIN Lead Time 정책 화면과 변경 Action

**Files:**
- Create: `app/(admin)/admin/scm-policies/leadtime/page.tsx`
- Create: `app/(admin)/admin/scm-policies/leadtime/actions.ts`
- Create: `components/admin/leadtime-policy-table.tsx`
- Create: `lib/leadtime-policy-admin.ts`
- Create: `lib/step9-admin.test.ts`

**Interfaces:**
- Consumes: `analytics.v_leadtime_policy`와 `core.admin_set_leadtime` RPC.
- Produces: ADMIN 전용 정책 조회·변경 흐름. 변경 시 reason 필수, `requireAdmin()` 선행, 서버에서만 RPC 호출.

- [ ] **Step 1: ADMIN 경계 테스트를 작성한다**

`actions.ts`와 `lib/leadtime-policy-admin.ts`에 `requireAdmin`, reason validation, `admin_set_leadtime` RPC가 존재하고 클라이언트에 secret/service role 키가 없음을 검사한다.

- [ ] **Step 2: 서버 helper와 Server Action을 구현한다**

`updateLeadtimePolicy({ supplierId, leadTime, effectiveFrom, reason })`는 `requireAdmin()` 후 `.schema('core').rpc('admin_set_leadtime', ...)`를 호출한다. 실패 시 `/admin/scm-policies/leadtime?error=update`로 이동하고 성공 시 `revalidatePath` 후 성공 메시지를 표시한다.

- [ ] **Step 3: 정책 표를 구현한다**

Item/Supplier, 실적 Lead Time, P50, P80, P90, 관리자 확정값, Effective Lead Time, 적용일, 변경자, 변경 이력을 표시한다. null 값은 `EmptyValue`로 표시하고 변경 입력에는 reason 필드를 required로 둔다.

- [ ] **Step 4: ADMIN 테스트를 실행한다**

Run: `node --test lib/step9-admin.test.ts`

Expected: ADMIN/RPC/reason 경계 pass.

### Task 7: 통합 메뉴·SQL·화면 검증

**Files:**
- Modify: `lib/step9-inventory-projection.test.ts`
- Modify: `lib/step9-pages.test.ts`
- Modify: `lib/menu.test.ts`

- [ ] **Step 1: SQL source leakage 계약을 확인한다**

Projection SQL이 `raw.usage_history`를 직접 읽지 않고 `analytics.v_forecast_result`와 챔피언 구조를 통해 Forecast를 읽는지 확인한다. `raw.inventory`, `raw.purchase_order`, `raw.sales_order`, `raw.business_event`는 input adapter에서만 사용한다.

- [ ] **Step 2: 전체 테스트를 실행한다**

Run: `npm test`

Expected: 모든 테스트 pass.

- [ ] **Step 3: production build를 실행한다**

Run: `npm run build`

Expected: `/analysis/stockout`, `/analysis/inventory-projection`, `/admin/scm-policies/leadtime` route가 포함된 build 성공.

- [ ] **Step 4: diff와 작업 트리를 확인한다**

Run: `git diff --check`; `git status --short`

Expected: whitespace 오류 없음. 의도하지 않은 파일 변경 없음.

### Task 8: 문서화와 커밋

**Files:**
- Modify: `SCHEMA.md`
- Modify: `docs/superpowers/specs/2026-08-28-step9-inventory-projection-design.md`

- [ ] **Step 1: SCHEMA.md에 신규 analytics/core 객체와 Projection 계산 규칙을 추가한다**

`v_inventory_projection`, `v_stockout_risk`, `v_leadtime_policy`, Risk 상태와 reason code를 문서화한다.

- [ ] **Step 2: 설계 문서와 구현 차이를 반영한다**

실제 적용한 status 경계와 입력 컬럼을 설계 문서에 반영하고 구현되지 않은 항목을 완료 조건으로 남기지 않는다.

- [ ] **Step 3: 최종 검증 후 커밋한다**

Run: `npm test`; `npm run build`; `git diff --check`

Commit:

```bash
git add supabase/migrations/20260828000800_step9_inventory_projection.sql lib app components docs SCHEMA.md
git commit -m "STEP9 Inventory Projection 구현"
```
