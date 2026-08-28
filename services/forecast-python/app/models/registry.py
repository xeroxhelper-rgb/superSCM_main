"""모델 registry. 선택 의존성은 요청 시점에 lazy import한다."""

from __future__ import annotations

from importlib import import_module
from typing import Any

from .base import ForecastModel, ForecastModelError
from .builtin import Croston, ExponentialSmoothing, Holt, HoltWinters, SBA, TSB
from .optional import ProphetModel, SARIMA, XGBoost


MODEL_REGISTRY: dict[str, ForecastModel] = {
    "PY_ETS": ExponentialSmoothing(), "PY_HOLT": Holt(), "PY_HOLT_WINTERS": HoltWinters(),
    "PY_CROSTON": Croston(), "PY_SBA": SBA(), "PY_TSB": TSB(),
    "PY_SARIMA": SARIMA(), "PY_PROPHET": ProphetModel(), "PY_XGBOOST": XGBoost(),
}


def list_models() -> list[dict[str, Any]]:
    return [{"model_id": model_id, "version": model.version, "applicable_demand_type": list(model.applicable_demand_type)} for model_id, model in MODEL_REGISTRY.items()]


def get_model(model_id: str) -> ForecastModel:
    try: return MODEL_REGISTRY[model_id]
    except KeyError as exc: raise ForecastModelError("MODEL_NOT_FOUND", f"모델을 찾을 수 없습니다: {model_id}") from exc
