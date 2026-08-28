# Python Forecast Service

별도 프로세스로 실행하는 FastAPI Forecast 배치 서비스입니다.

## 실행

```bash
cd services/forecast-python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

필수 서버 환경변수:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (브라우저와 Next.js public env에 절대 노출하지 않음)
- `FORECAST_SERVICE_TOKEN`

주요 API:

- `GET /health`
- `GET /models`
- `POST /forecast/run`
- `POST /backtest/run`

Forecast 입력은 `core.v_train_demand`만 사용합니다. 검증 Actual은 Forecast 학습에 포함하지 않으며, `/backtest/run`은 기존 Forecast Run을 STEP 7 scoring RPC에 전달합니다.
