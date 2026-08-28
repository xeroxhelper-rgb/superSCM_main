# STEP 9 Inventory Projection 설계

## 목표

기존 `available_inventory / average_usage` 기반 Stockout 계산을 폐기하고, STEP 7에서 저장한 Champion Forecast와 현재 재고·예정 입고·확정수주·Soft Allocation·Effective Lead Time을 결합한 기간별 Inventory Projection으로 교체한다. 모든 계산은 PostgreSQL View/RPC에서 수행하고 Next.js는 analytics 결과를 조회해 표시한다.

## 범위

- Effective Lead Time 및 변경 이력
- 기간별 Inventory Projection
- Projection 기반 Stockout Risk/KPI View 교체
- 관리자 Lead Time 정책 화면
- 사용자 Inventory Projection 화면
- 기존 `/analysis/stockout` 경로 유지
- 기존 레거시 Workflow 컴포넌트와 계산 로직은 변경하지 않음

## 데이터 흐름

```text
raw.inventory
raw.purchase_order
raw.sales_order
raw.business_event
analytics.v_forecast_result + core.champion_model
core.leadtime_plan + core.v_leadtime_effective
        ↓
core/analytics inventory projection views
        ↓
analytics.v_stockout_risk / analytics.v_stockout_kpi
        ↓
Stockout 화면 · Inventory Projection 화면
```

## DB 객체

새 migration은 `supabase/migrations/20260828000800_step9_inventory_projection.sql`로 추가한다.

### Lead Time

- `core.leadtime_policy_history`: 관리자 확정 Lead Time의 이전값·새 값·적용일·변경자·사유를 append-only로 기록한다.
- `core.v_effective_lead_time`: `core.leadtime_plan.planned_lead_time`이 있으면 관리자 확정값을 사용하고, 없으면 `core.v_leadtime_effective`의 실적 P80을 사용한다. 두 값이 모두 없으면 null과 `NO_LEADTIME`을 반환한다.
- `analytics.v_leadtime_policy`: 공급처, 실적 P50/P80/P90, 관리자 확정값, Effective 값, 적용일과 변경자를 제공한다.

### Inventory Projection

- `core.v_inventory_projection`: Forecast period를 기준으로 item별 projection 행을 생성한다.
- `analytics.v_inventory_projection`: 화면 계약에 맞는 컬럼명으로 노출한다.
- `analytics.v_stockout_risk`: 기존 View를 Projection 결과의 최초 ending inventory 0 이하 기간과 상태값으로 재작성한다.
- `analytics.v_stockout_kpi`: `SAFE`, `WARNING`, `CRITICAL`, `CALCULATION_UNAVAILABLE`을 집계한다.

## 계산 규칙

Projection의 첫 기간은 현재 재고 합계다. 재고 행이 없으면 0으로 보정하지 않고 `NO_INVENTORY_DATA`로 표시한다.

각 기간의 계산은 다음과 같다.

```text
Beginning Inventory
+ scheduled receipts whose receipt date falls in this period
- confirmed sales orders in this period
- soft allocations in this period
- champion forecast demand in this period
= Ending Projected Inventory
```

- Open PO는 `raw.purchase_order`의 `납기예정일`이 해당 period에 속할 때만 반영한다.
- 확정수주는 `raw.sales_order.status`가 확정 상태인 행만 반영한다.
- Soft Allocation은 `raw.business_event.event_type = 'SOFT_ALLOCATION'`인 행을 반영한다. 데이터 행이 없으면 실제 데이터 미존재로 구분할 수 있도록 `soft_allocation_source_status`를 제공한다.
- Forecast는 `analytics.v_forecast_result`에서 해당 item의 최신 성공 run에 속한 Champion Model 결과를 사용한다. Forecast가 없으면 `NO_FORECAST`다.
- 확정수주와 Forecast 중복 정책은 `core.policy_config`의 `CONFIRMED_ORDER_DEMAND_MODE`를 조회한다. 기본 운영값은 `ADDITIVE_COMMITTED`이며, 정책 변경으로 exclusive 운영을 선택할 수 있게 한다.
- 기존 `daily_usage_avg`, 단순 available inventory 나눗셈, 화면 내 통계 계산은 신규 Risk 판정에서 사용하지 않는다.

## Stockout 및 Risk

- `ending_projected_inventory <= 0`인 최초 period를 `stockout_period`로 반환한다.
- 월/주 단위 설정에서는 해당 period를 Stockout Period로 사용하며 임의의 일자를 만들지 않는다.
- Forecast 기간 내 소진이 없으면 `stockout_period`와 `stockout_date`는 null이다.
- Effective Lead Time이 없거나 시작 재고/Forecast가 없으면 Risk는 `CALCULATION_UNAVAILABLE`이며 원인 코드를 보존한다.
- 소진이 없거나 Effective Lead Time 밖에서 대응 가능한 경우 `SAFE`다.
- Lead Time 내 소진이 예상되고 현재 발주로 입고 전까지 유지 가능한 경우 `WARNING`이다.
- 예상 입고 전에 소진되는 경우 `CRITICAL`이다.
- `days_of_supply`와 `months_of_supply`는 Projection 결과 및 Forecast 수요로 SQL에서 계산하며 데이터가 부족하면 null이다.

## 권한

- `analytics` Projection/Policy View 조회는 기존 authenticated 정책을 따른다.
- Lead Time 확정값 변경은 `core.is_admin()`을 사용하는 SECURITY DEFINER RPC로만 허용한다.
- RPC는 자기 권한 우회, 임의 actor 지정, 사유 누락을 거부하고 변경 전후 값을 `core.leadtime_policy_history`와 `core.audit_log`에 기록한다.
- anon에게 raw/core 쓰기 권한을 부여하지 않는다.

## Next.js 화면

- `/analysis/stockout`: 기존 경로를 유지하고 `analytics.v_stockout_risk`와 KPI View를 조회한다.
- `/analysis/inventory-projection`: 기간별 Projection을 표시한다. React에서는 합계·누적·Risk를 계산하지 않는다.
- `/admin/scm-policies/leadtime`: Lead Time 정책과 이력 조회·변경 UI를 제공한다. 변경은 ADMIN Server Action을 통해 RPC를 호출한다.
- 메뉴는 `lib/menu.ts`에서 USER/ADMIN별로 관리한다.

## 테스트 전략

- 순수 모델 테스트로 SAFE/WARNING/CRITICAL 및 계산 불가 reason code를 검증한다.
- SQL 계약 테스트로 Projection View, Lead Time 우선순위, 기존 단순 계산 제거, RLS/RPC 경계를 검증한다.
- 페이지 계약 테스트로 신규 route와 공통 EmptyValue/Badge 사용을 검증한다.
- `npm test`, `npm run build`, `git diff --check`를 완료 조건으로 한다.
