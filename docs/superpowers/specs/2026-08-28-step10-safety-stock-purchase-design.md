# STEP 10 Safety Stock 및 Purchase Recommendation 설계

## 목표

STEP 7의 Forecast Error와 STEP 9의 Inventory Projection/Effective Lead Time을 결합해 SKU별 Safety Stock, 발주추천수량, 발주권고일을 SQL에서 계산한다.

## 데이터 흐름

```text
STEP 7 Forecast Error / Model Performance
STEP 9 Inventory Projection / Effective Lead Time
core.item_policy / core.policy_config
                ↓
analytics.v_safety_stock
                ↓
analytics.v_purchase_recommendation
                ↓
Purchase Recommendation 목록 / SKU 상세 화면
```

## 계산 정책

- `sigma_DLT = sqrt(L * sigma_d^2 + d^2 * sigma_L^2)`
- `Safety Stock = Z * sigma_DLT`
- `L`은 STEP 9 Effective Lead Time이다.
- `sigma_d`는 STEP 7의 저장 Forecast Error 변동성에서 가져온다.
- `d`는 STEP 7/9의 선택된 Forecast 수요량이다.
- `sigma_L`은 기존 실적 Lead Time의 표준편차다.
- `Z`는 item grade/service level 정책 테이블에서 조회한다.
- `demand_basis = max(forecast_qty, confirmed_order_qty)`
- `required_qty = demand_basis + safety_stock - available_inventory - scheduled_receipt`
- `required_qty <= 0`은 계산 성공이며 `recommended_qty = 0`이다.
- 양수 Required Qty에는 MOQ를 적용하고 Pack Size 배수로 올림한다.
- Recommended Order Date는 `stockout_date - effective_leadtime - safety_buffer_days`이다.
- 권고일이 오늘보다 과거이면 `immediate_order = true`, `overdue` 상태를 함께 제공한다.

## 계산 불가 정책

Forecast, Inventory, Lead Time, Forecast Error, Service Level, Item Policy가 없으면 임의 숫자를 만들지 않고 `calculation_status = CALCULATION_UNAVAILABLE`와 사유 코드를 반환한다. 발주 불필요는 `CALCULATED_NO_ORDER`로 구분한다.

## 화면

- `/analysis/purchase-recommendation`: SKU별 추천 목록 및 계산 근거 요약
- `/analysis/purchase-recommendation/[itemId]`: Forecast → Projection → Safety Stock → Stockout → Recommendation 흐름
- 화면은 analytics View만 조회하고 계산을 수행하지 않는다.

## 권한

추천 조회는 기존 USER 조회 정책을 따르고, 정책값 변경은 ADMIN만 허용한다. 새 화면과 조회 함수는 기존 RBAC/메뉴 구조를 재사용한다.

## 장애·호환성

기존 STEP 7/9 객체를 변경하지 않고 새 View를 추가한다. 기존 데이터가 부족해도 결과 행은 유지하며 계산 상태와 reason code로 표시한다.
