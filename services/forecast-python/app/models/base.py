"""모든 Python Forecast 모델이 공유하는 입출력 계약."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import numpy as np
import pandas as pd


class ForecastModelError(Exception):
    """모델 계산이 불가능할 때 사용하는 도메인 오류."""

    def __init__(self, reason_code: str, message: str):
        super().__init__(message)
        self.reason_code = reason_code


def future_periods(train_df: pd.DataFrame, horizon: int, params: dict[str, Any]) -> pd.DatetimeIndex:
    if horizon < 0:
        raise ForecastModelError("INVALID_HORIZON", "horizon은 0 이상이어야 합니다.")
    if train_df.empty or "period" not in train_df or train_df["period"].dropna().empty:
        raise ForecastModelError("NO_TRAIN_DATA", "학습 데이터가 없습니다.")
    last = pd.Timestamp(train_df["period"].dropna().max())
    freq = str(params.get("freq", "MS"))
    return pd.date_range(last + pd.offsets.MonthBegin(1), periods=horizon, freq=freq)


def clean_train(train_df: pd.DataFrame) -> pd.DataFrame:
    required = {"period", "qty"}
    if not required.issubset(train_df.columns):
        raise ForecastModelError("TRAIN_SCHEMA_INVALID", "train_df에는 period와 qty가 필요합니다.")
    clean = train_df[["period", "qty"]].copy()
    clean["period"] = pd.to_datetime(clean["period"], errors="coerce")
    clean["qty"] = pd.to_numeric(clean["qty"], errors="coerce")
    clean = clean.dropna(subset=["period", "qty"]).sort_values("period")
    if clean.empty:
        raise ForecastModelError("NO_TRAIN_DATA", "유효한 학습 데이터가 없습니다.")
    return clean


def output_frame(train_df: pd.DataFrame, values: list[float], horizon: int, params: dict[str, Any], reason_code: str | None = None) -> pd.DataFrame:
    periods = future_periods(train_df, horizon, params)
    point = np.maximum(np.asarray(values, dtype=float), 0)
    if len(point) != horizon:
        raise ForecastModelError("MODEL_OUTPUT_INVALID", "모델 출력 horizon이 요청과 다릅니다.")
    return pd.DataFrame({"period": periods, "predicted_qty": point, "p50": point, "p80": point, "p90": point, "reason_code": reason_code})


class ForecastModel(ABC):
    model_id: str
    version: str = "1.0.0"
    applicable_demand_type: tuple[str, ...] = ("SMOOTH", "ERRATIC", "INTERMITTENT", "LUMPY")

    @abstractmethod
    def forecast(self, train_df, horizon, params):
        """forecast(train_df, horizon, params) -> DataFrame"""
        raise NotImplementedError
