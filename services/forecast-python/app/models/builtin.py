"""외부 통계 패키지 없이 실행 가능한 Python Forecast adapter."""

from __future__ import annotations

import numpy as np

from .base import ForecastModel, ForecastModelError, clean_train, output_frame


class ExponentialSmoothing(ForecastModel):
    model_id = "PY_ETS"

    def forecast(self, train_df, horizon, params):
        train = clean_train(train_df)
        alpha = float(params.get("alpha", 0.3))
        if not 0 < alpha <= 1:
            raise ForecastModelError("INVALID_PARAMETER", "alpha는 0보다 크고 1 이하여야 합니다.")
        level = float(train["qty"].iloc[0])
        for value in train["qty"].iloc[1:]:
            level = alpha * float(value) + (1 - alpha) * level
        return output_frame(train, [level] * horizon, horizon, params)


class Holt(ForecastModel):
    model_id = "PY_HOLT"

    def forecast(self, train_df, horizon, params):
        train = clean_train(train_df)
        alpha = float(params.get("alpha", 0.3)); beta = float(params.get("beta", 0.1))
        level = float(train["qty"].iloc[0]); trend = 0.0
        for value in train["qty"].iloc[1:]:
            previous = level
            level = alpha * float(value) + (1 - alpha) * (level + trend)
            trend = beta * (level - previous) + (1 - beta) * trend
        return output_frame(train, [level + trend * step for step in range(1, horizon + 1)], horizon, params)


class HoltWinters(Holt):
    model_id = "PY_HOLT_WINTERS"

    def forecast(self, train_df, horizon, params):
        train = clean_train(train_df)
        season_length = int(params.get("season_length", 12))
        if len(train) < season_length * 2:
            raise ForecastModelError("INSUFFICIENT_HISTORY", "Holt-Winters에는 두 개 이상의 계절 주기가 필요합니다.")
        base = super().forecast(train, horizon, params)
        seasonal = train["qty"].to_numpy()[-season_length:]
        average = max(float(np.mean(seasonal)), 1e-9)
        base["predicted_qty"] = np.maximum(base["predicted_qty"] * np.resize(seasonal / average, horizon), 0)
        base["p50"] = base["predicted_qty"]; base["p80"] = base["predicted_qty"]; base["p90"] = base["predicted_qty"]
        return base


class Croston(ForecastModel):
    model_id = "PY_CROSTON"
    applicable_demand_type = ("INTERMITTENT", "LUMPY")

    def forecast(self, train_df, horizon, params):
        train = clean_train(train_df)
        nonzero = train.loc[train["qty"] > 0, "qty"].to_numpy()
        if len(nonzero) == 0:
            raise ForecastModelError("NO_NONZERO_DEMAND", "수요 발생 기간이 없습니다.")
        intervals = np.diff(np.flatnonzero(train["qty"].to_numpy() > 0), prepend=-1)
        return output_frame(train, [float(np.mean(nonzero) / max(float(np.mean(intervals)), 1.0))] * horizon, horizon, params)


class SBA(Croston):
    model_id = "PY_SBA"

    def forecast(self, train_df, horizon, params):
        result = super().forecast(train_df, horizon, params)
        result["predicted_qty"] *= 0.95
        result["p50"] = result["predicted_qty"]; result["p80"] = result["predicted_qty"]; result["p90"] = result["predicted_qty"]
        return result


class TSB(Croston):
    model_id = "PY_TSB"

    def forecast(self, train_df, horizon, params):
        train = clean_train(train_df)
        demand = train["qty"].to_numpy(dtype=float)
        probability = float(np.mean(demand > 0)); size = float(np.mean(demand[demand > 0])) if np.any(demand > 0) else 0
        if size == 0:
            raise ForecastModelError("NO_NONZERO_DEMAND", "수요 발생 기간이 없습니다.")
        return output_frame(train, [probability * size] * horizon, horizon, params)
