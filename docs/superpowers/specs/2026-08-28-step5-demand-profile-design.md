# STEP 5 SKU Demand Profile 설계

## 목표

Forecast 실행 전에 SKU별 학습 구간 수요 특성을 SQL에서 계산하고, Syntetos-Boylan-Croston 기준의 `SMOOTH`, `INTERMITTENT`, `ERRATIC`, `LUMPY` 코드를 제공한다. 결과는 STEP 6 모델 후보 선택과 `/analysis/demand-profile` 화면에서 재사용한다.

## 데이터 경계

Demand Profile 계산의 유일한 원천은 `core.v_train_demand`다. 이 view가 이미 `core.forecast_setting.train_start/train_end`로 제한하므로 SQL은 `raw.usage_history`와 `core.v_test_actual`을 조회하지 않는다. 검증 기간 actual은 profile, grid, KPI, trend, seasonality 계산에 절대 포함하지 않는다.

품목 universe는 `core.v_item_master`에서 가져온다. 따라서 학습 구간에 사용 이력이 없는 SKU도 결과에 남고, 계산 불가 사유를 표시할 수 있다.

## 월별 기간 Grid

`core.forecast_setting.granularity`와 무관하게 STEP 5의 기본 분석 단위는 월이다. `train_start` 월부터 `train_end` 월까지 `generate_series(..., interval '1 month')`로 모든 월을 만든 뒤 `item_id × month`를 생성한다.

월별 집계는 다음 규칙을 사용한다.

- 해당 SKU·월에 사용 행이 전혀 없으면 `period_qty = 0`, `is_missing_period = true`
- 사용 행은 있으나 수량이 모두 null이면 `period_qty = null`, `NULL_QUANTITY` 사유 후보
- 수량 값이 있으면 해당 월의 합계와 원본 행 수를 유지
- 원본 null을 0으로 바꾸지 않는다
- `qty > 0`인 월만 수요 발생 월로 센다

계산용 view 내부 CTE는 `period_grid`, `period_observation`, `profile_stats`로 나누고, 외부 출력 view는 집계 결과만 노출한다.

## 지표 계산

### ADI

`adi = n_periods / n_nonzero_periods`로 계산한다. `n_nonzero_periods = 0`이면 `adi = null`, `reason_code = NO_POSITIVE_DEMAND`를 반환한다.

### CV와 CV²

양수 수요가 발생한 월의 `period_qty`만 사용한다.

`cv = stddev_samp(positive_qty) / avg(positive_qty)`

`cv_squared = cv * cv`

양수 관측치가 2개 미만이거나 평균이 0이면 두 값 모두 null이며 `INSUFFICIENT_NONZERO_PERIODS` 또는 `ZERO_POSITIVE_MEAN`을 반환한다. null을 0으로 대체하지 않는다.

### Demand Type

ADI와 CV²가 모두 계산 가능한 경우에만 아래 기준으로 분류한다.

| 조건 | 코드 |
|---|---|
| `adi < 1.32 and cv_squared < 0.49` | `SMOOTH` |
| `adi >= 1.32 and cv_squared < 0.49` | `INTERMITTENT` |
| `adi < 1.32 and cv_squared >= 0.49` | `ERRATIC` |
| `adi >= 1.32 and cv_squared >= 0.49` | `LUMPY` |

계산 불가 SKU의 `demand_type`은 null이다. 한글 표시명은 화면에서만 매핑한다.

### Zero-demand Rate

`zero_demand_rate = zero_periods / n_periods`로 계산한다. 기간 Grid에 의해 만들어진 무수요 월과 수량이 실제로 0인 관측 월을 모두 무수요로 보되, 원본 null 월은 별도 `NULL_QUANTITY` 상태를 유지한다.

### Trend

월 순번을 독립변수로, 월별 수요량을 종속변수로 하여 `regr_slope(period_qty, period_index)`를 사용한다. 계산 가능한 기간이 2개 미만이면 `trend = null`, `reason_code = INSUFFICIENT_PERIODS`다. 원본 null이 있는 월은 trend 집계에서 제외하고, 제외 사실은 사유 후보에 반영한다.

### 최근 변화율

학습 기간의 마지막 3개 월과 그 직전 3개 월의 평균을 비교한다.

`recent_change_rate = (recent_avg - prior_avg) / nullif(prior_avg, 0)`

두 구간이 각각 3개월을 채우지 못하거나 직전 평균이 0이면 null과 `INSUFFICIENT_RECENT_PERIODS` 또는 `ZERO_PRIOR_MEAN`을 반환한다. 미래 기간을 이용해 보정하지 않는다.

### Peak Period

학습 Grid의 월별 수요량 중 최대값을 선택한다. 동률이면 가장 이른 월을 선택해 결정성을 보장한다. 양수 수요가 없으면 null이다.

### Seasonality

학습 Grid의 월 수가 24개월 미만이면 반드시 `seasonality = null`, `reason_code = INSUFFICIENT_PERIODS`다. 24개월 이상이면 각 달(1~12월)의 평균 수요를 계산하고, 모든 달에 최소 2개 관측이 있으며 전체 평균이 양수인 경우 월별 평균의 변동계수(`stddev_samp(month_mean) / avg(month_mean)`)가 `0.10` 이상이면 `true`, 미만이면 `false`로 판정한다. 월별 관측이 부족하거나 전체 평균이 0이면 `seasonality = null`과 `INSUFFICIENT_SEASONAL_DATA` 또는 `ZERO_OVERALL_MEAN`을 반환한다. 이 임계값은 SQL 주석과 설계 문서에 고정해 화면이나 TypeScript에서 임의로 변경하지 않는다. 데이터 부족을 `false`로 바꾸지 않는다.

## 출력 DB 객체

### `analytics.v_sku_demand_profile`

다음 컬럼을 제공한다.

`item_id`, `item_name`, `n_periods`, `n_nonzero_periods`, `adi`, `cv`, `cv_squared`, `zero_demand_rate`, `trend`, `recent_change_rate`, `peak_period`, `demand_type`, `seasonality`, `reason_code`, `stability`

`stability`는 CV²가 계산 가능하고 `cv_squared < 0.49`이면 `STABLE`, 그 이상이면 `VARIABLE`, 계산 불가면 null로 둔다.

`reason_code`는 우선순위를 명시한다: `NO_POSITIVE_DEMAND` → `NULL_QUANTITY` → `INSUFFICIENT_NONZERO_PERIODS` → `INSUFFICIENT_PERIODS` → 최근 지표별 사유. 여러 사유가 있으면 `reason_codes text[]`를 내부적으로 유지하고 화면용 `reason_code`에는 첫 번째 주요 사유를 제공한다.

### `analytics.v_demand_profile_kpi`

한 행을 반환하며 다음 컬럼을 제공한다.

`total_items`, `n_smooth`, `n_intermittent`, `n_erratic`, `n_lumpy`, `n_croston_needed`, `n_calculation_unavailable`

`n_croston_needed = n_intermittent + n_lumpy`이며, demand type이 null인 SKU는 `n_calculation_unavailable`에 포함한다.

## 애플리케이션 경계

- `lib/scm-model.ts`: Demand Profile과 KPI 정규화 타입. null은 null로 유지한다.
- `lib/scm.ts`: `analytics.v_sku_demand_profile`, `analytics.v_demand_profile_kpi` 조회 함수.
- `app/(user)/analysis/demand-profile/page.tsx`: 서버에서 analytics 조회 및 초기 렌더링.
- `components/analysis/demand-profile-table.tsx`: 표와 저장 결과 필터링 UI.
- `components/analysis/demand-profile-filters.tsx`: demand type, 계산 가능 여부, SKU 검색. 통계 재계산 금지.

필터는 query parameter 또는 client state로 저장된 행만 거른다. ADI/CV²/trend를 화면에서 계산하지 않는다. 계산 불가 값은 `EmptyValue`에 `reason_code`를 전달한다. Demand Type 배지는 공통 Badge를 사용하고 DB 코드는 그대로 표시한다.

## 권한과 RLS

analytics view는 anon 접근을 차단하고 authenticated 사용자에게 SELECT를 허용한다. view가 `core.v_train_demand`를 읽으므로 raw 직접 권한은 필요하지 않다. 기간 설정 변경은 STEP 3의 ADMIN 정책을 유지한다.

## Data Leakage 방지

정적 테스트는 application 코드에서 `raw.usage_history`와 `core.v_test_actual` 참조를 금지하고, SQL migration에서 profile view가 `core.v_train_demand`를 참조하는지 확인한다. train/test 경계는 날짜 리터럴을 사용하지 않고 `core.forecast_setting`에서만 읽는다. test 데이터 추가 전후 profile 결과가 동일한 것은 Supabase 통합 검증 쿼리로 확인한다.

## 테스트 케이스

- 동일한 양의 수요가 매월 반복되면 `SMOOTH`
- 드문 양의 수요와 낮은 변동이면 `INTERMITTENT`
- 빈번한 양의 수요와 높은 변동이면 `ERRATIC`
- 드문 양의 수요와 높은 변동이면 `LUMPY`
- 양의 수요가 없는 SKU는 null 지표와 `NO_POSITIVE_DEMAND`
- 기간이 부족한 SKU는 필요한 지표의 null과 사유 코드
- 24개월 미만은 seasonality null과 `INSUFFICIENT_PERIODS`
- test 기간 raw 행 추가가 train view/profile에 영향을 주지 않음
- peak 동률은 가장 이른 월

## STEP 6 연결

STEP 6은 `demand_type`의 영문 코드만 사용해 `model_config.applicable_demand_type`과 조인·필터한다. `INTERMITTENT`와 `LUMPY`는 Croston 계열 후보로 연결하고, null demand type은 자동 모델 선택에서 제외한 뒤 reason code를 사용자에게 보여준다.
