# STEP 7 Backtest·Champion·Model Comparison 설계

## 목표

STEP 6에서 저장한 Forecast Result를 STEP 3의 검증 Actual과 비교해 모델별 성능을 SQL로 계산하고, SKU별 Champion Model과 선정 근거를 저장한다. 사용자는 저장된 결과를 비교 화면에서 즉시 조회하며, 비교 화면은 Forecast나 Backtest를 재실행하지 않는다.

## 데이터 흐름

```text
core.forecast_result → analytics.v_forecast_result
core.v_test_actual   → analytics.v_test_actual
             ↓
       core.run_backtest()
             ↓
analytics.backtest_run
analytics.model_performance
analytics.champion_model
```

Backtest 함수는 Forecast 학습을 수행하지 않는다. 검증 기간의 Actual은 scoring에만 사용하고, `raw.usage_history`는 조회하지 않는다.

## DB 설계

- `analytics.backtest_run`: Forecast 실행과 분리된 Backtest 실행 이력. `forecast_run_id`, 검증 기간, metric, 상태, 실행자와 시간을 저장한다.
- `analytics.model_performance`: Backtest 실행별 SKU·모델 지표를 저장한다. WAPE, MAPE, Bias, RMSE, MAE, baseline improvement, rank와 계산 상태/사유를 함께 저장한다.
- `analytics.champion_model`: SKU별 현재 Champion snapshot을 저장한다. 후보 전체 성능을 `candidate_performance` JSONB로 보존하고 AUTO/MANUAL 선정 방식, 사유, 실행자를 기록한다. 이전 기록은 삭제하지 않도록 snapshot 이력 형태로 저장한다.
- `core.forecast_setting.champion_metric`: Champion metric을 설정값으로 사용한다. 설정이 없으면 Backtest 실행을 실패시키며 임의의 기준을 사용하지 않는다.
- 기준 모델은 `core.model_config.is_default` 또는 명시된 reference model 설정으로 관리한다.

## 지표 및 null 정책

- WAPE = `sum(abs(actual - forecast)) / sum(actual) * 100`. Actual 합계가 0이면 null, `ACTUAL_SUM_ZERO`.
- MAPE = Actual이 0이 아닌 기간만 percentage error 평균에 포함한다. 모든 기간의 Actual이 0이거나 비교 행이 없으면 null, `MAPE_DENOMINATOR_ZERO` 또는 `NO_COMPARISON_ROWS`.
- Bias = `sum(forecast - actual) / sum(actual) * 100`. 양수는 over-forecast, 음수는 under-forecast다. Actual 합계가 0이면 null.
- RMSE = `sqrt(avg((forecast - actual)^2))`, MAE = `avg(abs(forecast - actual))`. Forecast/Actual 양쪽이 존재하는 비교 행이 없으면 null.
- 누락 Forecast, 누락 Actual, 기간 부족은 숫자로 보정하지 않고 `calculation_status`와 `reason_code`로 저장한다.
- baseline improvement는 reference model과 현재 모델의 동일 metric을 비교할 수 있을 때만 계산한다.

## Rank와 Champion

- `forecast_setting.champion_metric`을 사용한다. 낮을수록 좋은 metric(WAPE, MAPE, RMSE, MAE)을 오름차순으로 순위화한다.
- 동점은 `absolute Bias`, `RMSE`, `MAE`, `model_id` 순으로 결정한다.
- 유효한 metric이 있는 후보만 rank 대상이다. 계산 불가 모델은 rank 1이 될 수 없다.
- 유효 후보 중 1위 모델을 AUTO Champion으로 저장한다. 후보가 없으면 Champion row를 만들지 않고 실행 결과에 `NO_VALID_CANDIDATE`를 남긴다.
- `candidate_performance`에는 해당 SKU의 모든 후보 지표와 계산 상태를 저장한다.
- 수동 변경은 ADMIN 전용 RPC/Server Action에서 reason text/code를 필수로 받고 MANUAL snapshot을 추가하며 `core.audit_log`에 이전/이후 Champion을 기록한다.

## 애플리케이션 경계

- `lib/scm-model.ts`: Backtest/Performance/Champion/Comparison 타입과 정규화.
- `lib/scm.ts`: analytics view 조회 함수만 제공.
- `lib/backtest-admin.ts`: `requireAdmin()` 이후 Backtest 실행 및 Manual Champion RPC 호출.
- `components/chart/forecast-overlay-chart.tsx`: 저장된 시계열을 렌더링만 하는 공통 SVG wrapper. 지표 계산과 재실행은 하지 않는다.
- `/analysis/model-comparison`: USER가 저장된 Forecast Result, 검증 Actual, Model Performance를 조합해 필터링하고 표시한다. 모델 toggle은 클라이언트 상태만 바꾼다.

## 권한과 RLS

- USER: 허용된 analytics view 조회.
- ADMIN: Backtest 실행, 설정 변경, Manual Champion 변경.
- DB RPC와 Server Action 양쪽에서 ADMIN을 확인한다. RLS는 anon 접근을 차단하고, performance/champion mutation은 함수 경계로 제한한다.

## 검증

순수 함수 테스트로 완전 일치·과대/과소예측 Bias·RMSE/MAE·Actual 0 MAPE·rank·Champion·Manual reason 필수 정책을 검증한다. 정적 계약 테스트로 scoring source가 `analytics.v_forecast_result`와 `core.v_test_actual`에 한정되고 raw 직접 조회나 Forecast 재실행이 없는지, toggle이 RPC를 호출하지 않는지 확인한다. 마지막으로 `npm test`, `npx tsc --noEmit`, `npm run build`를 실행한다.
