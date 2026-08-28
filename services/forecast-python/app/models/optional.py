"""선택 패키지를 실행 시점에만 불러오는 고급 모델 adapter."""

from __future__ import annotations

import importlib

import numpy as np

from .base import ForecastModel, ForecastModelError, clean_train, output_frame


class SARIMA(ForecastModel):
    model_id = "PY_SARIMA"
    applicable_demand_type = ("SMOOTH", "ERRATIC")

    def forecast(self, train_df, horizon, params):
        train = clean_train(train_df)
        try:
            from statsmodels.tsa.statespace.sarimax import SARIMAX
        except ImportError as exc:
            raise ForecastModelError("MODEL_DEPENDENCY_UNAVAILABLE", "statsmodels가 설치되지 않았습니다.") from exc
        order = tuple(params.get("order", (1, 1, 1)))
        seasonal_order = tuple(params.get("seasonal_order", (0, 0, 0, 0)))
        fitted = SARIMAX(train["qty"].to_numpy(dtype=float), order=order, seasonal_order=seasonal_order, enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
        values = fitted.forecast(steps=horizon).tolist()
        return output_frame(train, values, horizon, params)


class ProphetModel(ForecastModel):
    model_id = "PY_PROPHET"
    applicable_demand_type = ("SMOOTH", "ERRATIC")

    def forecast(self, train_df, horizon, params):
        train = clean_train(train_df)
        try:
            Prophet = importlib.import_module("prophet").Prophet
        except ImportError as exc:
            raise ForecastModelError("MODEL_DEPENDENCY_UNAVAILABLE", "prophet가 설치되지 않았습니다.") from exc
        model = Prophet(yearly_seasonality=bool(params.get("yearly_seasonality", True)), weekly_seasonality=False, daily_seasonality=False)
        model.fit(train.rename(columns={"period": "ds", "qty": "y"})[["ds", "y"]])
        future = model.make_future_dataframe(periods=horizon, freq=str(params.get("freq", "MS")), include_history=False)
        forecast = model.predict(future)
        result = output_frame(train, forecast["yhat"].to_numpy().tolist(), horizon, params)
        result["p50"] = forecast["yhat"].to_numpy(); result["p80"] = forecast["yhat_upper"].to_numpy(); result["p90"] = forecast["yhat_upper"].to_numpy()
        return result


class XGBoost(ForecastModel):
    model_id = "PY_XGBOOST"
    applicable_demand_type = ("SMOOTH", "ERRATIC")

    def forecast(self, train_df, horizon, params):
        train = clean_train(train_df)
        try:
            XGBRegressor = importlib.import_module("xgboost").XGBRegressor
        except ImportError as exc:
            raise ForecastModelError("MODEL_DEPENDENCY_UNAVAILABLE", "xgboost가 설치되지 않았습니다.") from exc
        lags = int(params.get("lags", 3))
        values = train["qty"].to_numpy(dtype=float)
        if len(values) <= lags: raise ForecastModelError("INSUFFICIENT_HISTORY", "XGBoost lag 학습기간이 부족합니다.")
        x, y = [], []
        for index in range(lags, len(values)): x.append(values[index - lags:index]); y.append(values[index])
        model = XGBRegressor(n_estimators=int(params.get("n_estimators", 100)), max_depth=int(params.get("max_depth", 3)), objective="reg:squarederror")
        model.fit(np.asarray(x), np.asarray(y)); history = list(values); predictions = []
        for _ in range(horizon): prediction = max(float(model.predict(np.asarray([history[-lags:]]))[0]), 0); predictions.append(prediction); history.append(prediction)
        return output_frame(train, predictions, horizon, params)
