# STEP 6 Forecast Engine 설계

## 목표

학습 구간 데이터만 사용해 SQL Baseline Forecast를 실행하고, 모델 정의·버전·입력 snapshot·결과를 모두 저장하는 재현 가능한 Forecast 파이프라인을 만든다. STEP 7 Backtest와 STEP 9~10 재고·구매 추천은 저장된 analytics view를 조회해 사용한다.

## 데이터 경계

Forecast 계산의 유일한 입력은 `core.v_train_demand`에서 만든 월별 train grid다. `raw.usage_history`를 Forecast 코드에서 직접 조회하지 않고, `core.v_test_actual`과 검증기간 actual도 사용하지 않는다. 학습 경계와 horizon은 `core.forecast_setting`의 현재 값에서만 읽고 날짜 리터럴을 SQL/TypeScript에 넣지 않는다.

월별 grid는 `train_start` 월부터 `train_end` 월까지 생성한다. 각 SKU·월의 관측값이 없으면 그 기간의 fitted/forecast 계산에는 수요 0을 사용하되, 원본 null 수량은 0으로 치환하지 않고 계산 불가 사유를 보존한다. 미래 기간은 `train_end` 다음 월부터 `forecast_horizon`까지 생성한다.

## 모델 레지스트리

### `core.model_config`

다음 컬럼을 갖는다.

`model_id`, `model_name`, `family`, `engine`, `version`, `enabled`, `is_default`, `applicable_demand_type`, `parameters`, `description`, `updated_at`, `updated_by`

Baseline 모델은 다음 초기 definition으로 등록한다.

| model_id | family | engine | 적용 demand type | 기본 parameters |
|---|---|---|---|---|
| `MA_3M` | `MOVING_AVERAGE` | `SQL` | `SMOOTH`, `INTERMITTENT`, `ERRATIC`, `LUMPY` | `{\"window\":3}` |
| `MA_6M` | `MOVING_AVERAGE` | `SQL` | `SMOOTH`, `INTERMITTENT`, `ERRATIC`, `LUMPY` | `{\"window\":6}` |
| `WMA_3M` | `WEIGHTED_MOVING_AVERAGE` | `SQL` | `SMOOTH`, `INTERMITTENT`, `ERRATIC`, `LUMPY` | `{\"weights\":[1,2,3],\"order\":\"oldest_to_recent\"}` |
| `PY_SAME_MONTH` | `SEASONAL_NAIVE` | `SQL` | 설정값으로 관리 | `{\"lag_months\":12}` |
| `SEASONAL_NAIVE` | `SEASONAL_NAIVE` | `SQL` | 설정값으로 관리 | `{\"lag_months\":12}` |

`applicable_demand_type`은 `text[]`로 두어 STEP 5의 영문 코드와 직접 연결한다. 모델이 현재 수요 유형에 적용되지 않으면 결과 행을 만들지 않고 실행 메시지/사유에 남긴다. 화면은 model_config를 수정할 수 있지만 실행 함수가 실제로 enabled, applicable type, parameters를 다시 검증한다.

## 모델 버전 snapshot

### `core.model_version`

`model_version_id`, `model_id`, `version`, `definition`, `parameters`, `created_at`, `created_by`를 저장한다. 실행 시 enabled 모델마다 현재 `model_config`의 version, definition, parameters, applicable demand type을 JSON snapshot으로 복사한다. `forecast_result.model_version`은 이 snapshot의 version을 기록하고, 과거 실행은 이후 model_config가 변경되어도 `model_version`에서 당시 정의를 다시 조회할 수 있다.

## Forecast 실행 객체

### `core.forecast_run`

다음 컬럼을 저장한다.

`run_id`, `status`, `granularity`, `train_start`, `train_end`, `horizon`, `champion_metric`, `data_snapshot_at`, `models`, `n_models`, `n_items`, `n_rows`, `started_at`, `finished_at`, `duration_ms`, `triggered_by`, `triggered_email`, `note`, `message`

`status`는 `RUNNING`, `SUCCESS`, `FAILED`만 허용한다. 실행 함수는 먼저 RUNNING을 insert하고, 성공 시 결과 집계와 종료 정보를 업데이트한다. 예외는 `exception block`에서 FAILED와 오류 메시지를 남기고 재발생시켜 호출자가 실패를 알 수 있게 한다. `run_id`는 모든 결과 저장의 필수 FK다.

### `core.forecast_result`

PK는 `(run_id, model_id, item_id, period)`이며 다음 값을 저장한다.

`run_id`, `model_id`, `item_id`, `period`, `model_version`, `predicted_qty`, `p50`, `p80`, `p90`, `sigma`, `basis`, `reason_code`, `created_at`

과거 run의 결과는 update/delete하지 않는다. 재실행은 새 run_id로 저장한다.

## Baseline 계산

### Point forecast

- `MA_3M`: 직전 3개 학습 월의 수요 평균
- `MA_6M`: 직전 6개 학습 월의 수요 평균
- `WMA_3M`: 직전 3개 학습 월에 오래된 순서로 `1, 2, 3`을 적용한 가중평균. 즉 최근순 가중치는 `3:2:1`이다.
- `PY_SAME_MONTH`: 12개월 전 같은 월의 학습 수요
- `SEASONAL_NAIVE`: 설정된 `lag_months`의 같은 월 수요. 초기값은 12개월이다.

필요한 과거 기간이 없거나 원본 null 때문에 입력을 확정할 수 없으면 임의 forecast를 만들지 않는다. `predicted_qty`와 interval을 null로 저장하고 `INSUFFICIENT_HISTORY`, `NULL_TRAIN_INPUT`, `MODEL_NOT_APPLICABLE` 같은 reason code를 남긴다. null을 0으로 바꾸지 않는다.

### Fitted value와 sigma

학습 Grid의 각 모델에 대해 과거 각 기간을 forecast 시점으로 보고 같은 baseline을 재귀적으로 적용하지 않는 one-step-ahead fitted value를 계산한다. `residual = actual - fitted`로 만들고, SKU·모델별 residual의 표본 표준편차를 `sigma`로 저장한다. fitted 또는 actual이 null인 residual은 제외하며 유효 residual이 부족하면 sigma는 null이다.

`p50`은 point forecast와 동일하다. `p80`과 `p90`은 sigma가 계산 가능한 경우에만 다음 정규근사로 계산한다.

`p80 = p50 + 0.841621 * sigma`

`p90 = p50 + 1.281552 * sigma`

sigma가 null이면 `p80`, `p90`도 null이며 숫자로 보정하지 않는다. `basis`에는 모델 ID와 계산 방식, 불가 시 reason code를 기록한다.

## 실행 함수

`core.run_baseline_forecast()`는 SECURITY DEFINER가 필요한 경우에도 내부에서 `core.is_admin()`을 먼저 검사하고 search_path를 고정한다. 실행 순서는 다음과 같다.

1. Forecast setting과 학습 경계·horizon·granularity 조회
2. 현재 enabled SQL model과 STEP 5 demand type 결과 조회
3. model_config definition/parameters를 model_version snapshot으로 저장
4. `data_snapshot_at`을 train source의 현재 변경 기준 시각으로 결정
5. forecast_run을 RUNNING으로 생성
6. 모델별 fitted/residual/sigma와 미래 기간 point forecast 계산
7. forecast_result를 새 run_id로 insert
8. n_models/n_items/n_rows를 집계하고 SUCCESS 처리
9. 오류 시 FAILED와 message 저장

같은 data snapshot과 같은 model definition이면 입력 순서에 영향을 받지 않도록 월·SKU·모델을 명시적으로 정렬해 같은 결과가 나오게 한다.

## Stale 판정

`data_snapshot_at` 이후 학습 원천이 변경되었는지 확인하기 위해 `analytics.v_forecast_run`에서 `core.v_train_demand`의 `loaded_at` 최대값과 run snapshot을 비교한다. 최대 `loaded_at`이 snapshot보다 크거나 source row 기준이 달라진 경우 `is_stale = true`, 원천이 없거나 비교할 수 없으면 `false`로 단정하지 않고 `stale_reason`을 제공한다. stale가 되어도 과거 forecast_result는 삭제하지 않는다.

## Analytics View

다음 view를 authenticated 사용자에게 SELECT 제공하고 anon 접근은 차단한다.

- `analytics.v_model_config`: 현재 모델 레지스트리와 적용 demand type/parameters
- `analytics.v_forecast_run`: 실행 상태, 학습 기간, 모델·SKU·결과 건수, snapshot, stale, 실행자
- `analytics.v_forecast_result`: run별 SKU·기간·모델 결과와 p50/p80/p90/sigma/reason
- `analytics.v_forecast_run_kpi`: run별 모델 수·SKU 수·결과 수·성공/실패 요약

화면은 core 테이블을 직접 조회하지 않는다.

## 관리자 화면

- `/admin/forecast-models`: 모델명, family, engine, version, enabled, applicable demand type, parameters를 표시하고 ADMIN Server Action으로 enabled/parameters를 변경한다.
- `/admin/forecast-runs`: run_id, 상태, 실행시간, 모델 수, SKU 수, 결과 행 수, data snapshot, stale, 실행자를 표시하고 ADMIN만 Forecast 실행을 요청할 수 있다.

모델 설정 변경과 실행 action은 서버에서 `requireAdmin()`을 호출한다. 메뉴 숨김은 UX이고 권한 검증은 서버/RLS/RPC에서 별도로 강제한다.

## RLS와 권한

- `anon`은 model/run/result와 raw/core 업무 데이터에 접근할 수 없다.
- `authenticated` USER는 analytics forecast 결과와 run을 SELECT할 수 있다.
- `ADMIN`만 `core.model_config` mutation과 `core.run_baseline_forecast()` 호출이 가능하다.
- model_version과 forecast_run/result는 과거 실행 보존을 위해 authenticated 직접 mutation을 허용하지 않고 실행 함수가 저장한다.
- service role key는 사용하지 않으며, 필요 시에도 서버 전용 경계를 유지한다.

## 테스트 경계

### 정적·단위 테스트

- `MA_3M`, `MA_6M`, `WMA_3M` window/weight 정의 검증
- 12개월 이력 부족 시 `PY_SAME_MONTH`가 결과를 임의 생성하지 않는지 검증
- sigma 부족 시 p80/p90이 null인지 검증
- model type union과 parameters snapshot 보존 검증
- Forecast 코드가 raw usage/test view를 직접 조회하지 않는지 검증
- 관리자 action이 `requireAdmin()`과 RPC 경계를 사용하는지 검증

### Supabase 통합 검증

- 실행 후 새 run_id, RUNNING→SUCCESS, model_version snapshot, 결과 PK/행 집계 확인
- 의도적인 SQL 오류 또는 잘못된 설정으로 FAILED run과 message 확인
- train 데이터 추가 후 과거 run의 `is_stale = true` 확인
- test 기간 actual 변경 전후 train 기반 결과가 동일한지 확인
- 동일 snapshot·동일 definition 재실행 결과가 동일한지 확인

## STEP 7 연결

STEP 7 Backtest는 `analytics.v_forecast_result`에서 특정 run/model/SKU/period의 point forecast를 조회하고, `core.v_test_actual`은 scoring actual 전용으로 사용한다. 모델 체크박스는 Forecast를 다시 실행하지 않고 저장된 result를 필터링한다. model_version과 run snapshot을 함께 표시하면 어떤 모델 정의로 backtest가 수행됐는지 재현할 수 있다.
