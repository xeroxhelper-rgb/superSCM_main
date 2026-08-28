from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .config import Settings
from .models.registry import list_models
from .repository import ForecastRepository
from .service import ForecastService

app = FastAPI(title="SCM Python Forecast Service", version="1.0.0")
settings = Settings.from_env()


class ForecastRequest(BaseModel):
    model_ids: list[str] | None = None
    horizon: int | None = Field(default=None, ge=0)
    triggered_email: str | None = None


class BacktestRequest(BaseModel):
    forecast_run_id: UUID
    metric: str | None = None


def service() -> ForecastService:
    return ForecastService(ForecastRepository.from_settings(settings))


def authorize(token: str | None) -> None:
    if settings.internal_token and token != settings.internal_token: raise HTTPException(status_code=401, detail="유효한 서비스 토큰이 필요합니다.")


@app.get("/health")
def health() -> dict[str, str]: return {"status": "ok", "service": settings.service_name}


@app.get("/models")
def models() -> list[dict[str, Any]]: return list_models()


@app.post("/forecast/run")
def forecast_run(request: ForecastRequest, x_forecast_token: str | None = Header(default=None)):
    authorize(x_forecast_token)
    try: return service().run_forecast(request.model_ids, request.horizon, request.triggered_email)
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/backtest/run")
def backtest_run(request: BacktestRequest, x_forecast_token: str | None = Header(default=None)):
    authorize(x_forecast_token)
    try: return {"backtest_run_id": service().repository.run_backtest(request.forecast_run_id, request.metric), "status": "SUCCESS"}
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc
