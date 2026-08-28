from __future__ import annotations

from typing import Any
from uuid import UUID

import pandas as pd

from .models.base import ForecastModelError
from .models.registry import get_model, list_models
from .repository import ForecastRepository


class ForecastService:
    def __init__(self, repository: ForecastRepository):
        self.repository = repository

    def run_forecast(self, model_ids: list[str] | None = None, horizon: int | None = None, triggered_email: str | None = None) -> dict[str, Any]:
        setting = self.repository.load_setting()
        selected = model_ids or [model["model_id"] for model in list_models()]
        effective_horizon = setting.get("forecast_horizon", 6) if horizon is None else horizon
        if effective_horizon < 0: raise ForecastModelError("INVALID_HORIZON", "horizon은 0 이상이어야 합니다.")
        run_id = self.repository.create_forecast_run(setting, effective_horizon, triggered_email)
        try:
            train_rows = self.repository.load_train_rows()
            profiles = {str(row["item_id"]): str(row.get("demand_type") or "") for row in self.repository.load_profiles()}
            train = pd.DataFrame(train_rows)
            if train.empty: raise ForecastModelError("NO_TRAIN_DATA", "core.v_train_demand에 학습 데이터가 없습니다.")
            result_rows: list[dict[str, Any]] = []; item_ids = sorted(train["item_id"].astype(str).unique())
            for model_id in selected:
                model = get_model(model_id); params = {"freq": "MS"}; model_version = self.repository.save_model_version(model_id, model.version, params)
                for item_id in item_ids:
                    demand_type = profiles.get(item_id, "")
                    if demand_type and demand_type not in model.applicable_demand_type: continue
                    item_train = train.loc[train["item_id"].astype(str) == item_id, ["use_date", "qty"]].rename(columns={"use_date": "period"})
                    forecast = model.forecast(item_train, effective_horizon, params)
                    for row in forecast.to_dict("records"):
                        result_rows.append({"run_id": str(run_id), "model_id": model_id, "item_id": item_id, "period": pd.Timestamp(row["period"]).date().isoformat(), "model_version": str(model_version), "predicted_qty": float(row["predicted_qty"]), "p50": float(row["p50"]), "p80": float(row["p80"]), "p90": float(row["p90"]), "basis": f"{model_id}:PYTHON", "reason_code": row.get("reason_code")})
            self.repository.save_results(result_rows)
            self.repository.mark_success(run_id, len(selected), len(item_ids), len(result_rows))
            return {"run_id": str(run_id), "status": "SUCCESS", "n_rows": len(result_rows)}
        except Exception as exc:
            self.repository.mark_failed(run_id, str(exc))
            raise
