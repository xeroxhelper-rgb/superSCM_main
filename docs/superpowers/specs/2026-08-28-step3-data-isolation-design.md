# STEP 3 데이터 모델 확장과 학습·검증 격리 설계

## 목표

STEP 4 파일 업로드와 STEP 5~6 Forecast 기능이 사용할 raw/core/analytics 데이터 계약을 확정하고, 학습 데이터와 검증 데이터를 DB 뷰 경계에서 분리한다.

## 설계

- raw에는 `business_event`, `sales_order`, `item_substitute`를 추가하고 기존 raw 입력 테이블에는 nullable 적재 추적 컬럼을 확장한다.
- 운영 정책은 `core.policy_config`, 예외 규칙은 `core.outlier_rule`, 품목별 정책은 `core.item_policy`에서 관리한다.
- `core.forecast_setting`의 단일 설정 행에서 train/test 기간과 granularity를 관리한다. 날짜는 TypeScript나 계산 SQL에 고정하지 않는다.
- `core.v_train_demand`는 forecast_setting의 train 기간만, `core.v_test_actual`은 test 기간만 반환한다.
- `analytics.v_data_coverage`는 실제 raw 사용 이력 범위와 설정 기간의 적합성을 반환한다.
- `analytics.v_forecast_setting_admin`은 ADMIN 검증 화면에서 기간·격리 상태·정책값을 읽을 수 있는 통합 view다.

## 데이터 흐름

```text
raw.usage_history → core.v_train_demand → Forecast / Demand Profile
raw.usage_history → core.v_test_actual  → Backtest scoring
```

두 view는 동일한 `use_date`를 공유하지만, 서로 다른 설정 범위 조건을 가지며 겹치는 기간을 허용하지 않는다. 설정 기간이 없거나 실제 데이터 범위를 벗어나면 coverage의 window 상태는 false다.

## 권한과 보존

- raw 입력 테이블은 기존 데이터와 view를 보존하기 위해 DROP/RECREATE하지 않고 ALTER/CREATE 방식으로 확장한다.
- anon의 raw/core/analytics 접근은 차단한다.
- authenticated는 학습·검증 view를 조회할 수 있다.
- policy/config 테이블 mutation은 ADMIN 정책으로만 허용한다.
- 계산 불가 또는 기간 미설정 값은 null로 유지하며 0으로 대체하지 않는다.

## 관리자 화면

`/admin/forecast-settings`는 `analytics.v_forecast_setting_admin`을 조회하여 전체 데이터 기간, train/test 기간, granularity, 격리 상태와 정책값을 표시한다. 이번 단계에서는 설정 변경보다 검증 가능한 조회 계약을 우선한다.
