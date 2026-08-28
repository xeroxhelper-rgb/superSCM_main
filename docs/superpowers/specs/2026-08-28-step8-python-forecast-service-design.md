# STEP 8 Python Forecast Service 설계

## 목표

STEP 6의 Forecast 저장 구조와 STEP 7의 Backtest·Model Comparison을 유지하면서 Python 고급 모델을 별도 FastAPI 배치 서비스로 추가한다. Python 서비스 장애가 Next.js의 기존 저장 결과 조회를 막지 않도록 실행과 조회 경계를 분리한다.

## 서비스 경계

`services/forecast-python`은 FastAPI 앱이며 Next.js와 별도 프로세스로 실행된다. 서비스는 `POST /forecast/run`, `POST /backtest/run`, `GET /models`, `GET /health`를 제공한다. `/forecast/run`은 `core.v_train_demand`만 학습 입력으로 사용하고 `core.forecast_run`, `core.model_version`, `core.forecast_result`에 저장한다. `/backtest/run`은 Forecast를 재실행하지 않고 저장된 `forecast_run_id`로 STEP 7 `core.run_backtest` RPC를 호출한다.

## 모델 인터페이스

모든 모델은 `forecast(train_df, horizon, params) -> pandas.DataFrame`를 구현하며 출력은 `period`, `predicted_qty`, `p50`, `p80`, `p90`, `reason_code` 컬럼을 가진다. Registry는 모델 ID, 버전, 적용 Demand Type, 파라미터를 관리한다.

- 내장 adapter: Exponential Smoothing, Holt, Holt-Winters, Croston, SBA, TSB
- 선택 의존성 adapter: SARIMA(statsmodels), Prophet(prophet), XGBoost(xgboost)
- 선택 의존성 미설치 시 해당 모델만 unavailable 상태로 처리하고 서비스 health와 기존 DB 조회에는 영향을 주지 않는다.

## DB 연동과 보안

`20260828000700_step8_python_forecast.sql`에서 `core.model_config.engine`에 `PYTHON`을 허용하고 Python 모델 registry를 추가한다. Python service key는 서버 환경변수로만 읽으며 브라우저나 Next.js public env에 넣지 않는다. 저장 시 `run_id`를 먼저 만들고, 각 실행의 model version과 parameter snapshot을 저장한다. 예외 시 동일 run을 `FAILED`로 업데이트한다.

## Data Leakage 방지

Forecast service의 데이터 조회는 `core.v_train_demand`와 forecast 설정만 허용한다. `core.v_test_actual`은 Python Forecast 학습에 사용하지 않는다. 검증 Actual은 STEP 7의 Backtest RPC에서만 사용한다.

## Next.js 연결

Next.js는 Python service URL로 요청을 전달하는 서버 전용 helper와 ADMIN 전용 Server Action만 제공한다. 기존 analytics 조회 함수와 Model Comparison은 독립적으로 유지되어 Python 서비스가 중단되어도 저장된 결과 조회가 가능하다.

## 검증

Python 단위 테스트로 공통 출력 schema, 내장 모델, intermittent model 적용, dependency unavailable 상태, horizon/null 정책, 실패 run 기록을 검증한다. TypeScript 정적 테스트로 Python model ID가 STEP 7 registry와 연결되고 Next.js client에 secret이 노출되지 않는지 검사한다. `npm test`, Python test, `npx tsc --noEmit`, `npm run build`를 실행한다.
