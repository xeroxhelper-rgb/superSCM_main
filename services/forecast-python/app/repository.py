"""Supabase 저장 경계. service role key는 이 서버 프로세스 안에서만 사용한다."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from supabase import Client, create_client

from .config import Settings


class ForecastRepository:
    def __init__(self, client: Client):
        self.client = client

    @classmethod
    def from_settings(cls, settings: Settings) -> "ForecastRepository":
        settings.validate()
        return cls(create_client(settings.supabase_url, settings.supabase_service_role_key))

    def load_setting(self) -> dict[str, Any]:
        response = self.client.schema("core").table("forecast_setting").select("*").eq("setting_id", 1).single().execute()
        return response.data

    def load_train_rows(self) -> list[dict[str, Any]]:
        response = self.client.schema("core").table("v_train_demand").select("item_id,use_date,qty").order("use_date").execute()
        return response.data or []

    def load_profiles(self) -> list[dict[str, Any]]:
        response = self.client.schema("analytics").table("v_sku_demand_profile").select("item_id,demand_type").execute()
        return response.data or []

    def create_forecast_run(self, setting: dict[str, Any], horizon: int, triggered_email: str | None = None) -> UUID:
        run_id = uuid4()
        payload = {"run_id": str(run_id), "status": "RUNNING", "granularity": setting["granularity"], "train_start": setting.get("train_start"), "train_end": setting.get("train_end"), "horizon": horizon, "champion_metric": setting.get("champion_metric"), "data_snapshot_at": datetime.now(timezone.utc).isoformat(), "triggered_email": triggered_email, "message": "Python Forecast 실행 중"}
        self.client.schema("core").table("forecast_run").insert(payload).execute()
        return run_id

    def save_model_version(self, model_id: str, version: str, parameters: dict[str, Any]) -> UUID:
        response = self.client.schema("core").table("model_version").insert({"model_id": model_id, "version": version, "definition": {"engine": "PYTHON", "model_id": model_id}, "parameters": parameters}).execute()
        return UUID(str(response.data[0]["model_version_id"]))

    def save_results(self, rows: list[dict[str, Any]]) -> None:
        if rows:
            self.client.schema("core").table("forecast_result").insert(rows).execute()

    def mark_success(self, run_id: UUID, model_count: int, item_count: int, result_count: int) -> None:
        self.client.schema("core").table("forecast_run").update({"status": "SUCCESS", "n_models": model_count, "n_items": item_count, "n_rows": result_count, "finished_at": datetime.now(timezone.utc).isoformat(), "message": "Python Forecast 실행 완료"}).eq("run_id", str(run_id)).execute()

    def mark_failed(self, run_id: UUID, error_message: str) -> None:
        self.client.schema("core").table("forecast_run").update({"status": "FAILED", "finished_at": datetime.now(timezone.utc).isoformat(), "message": error_message, "error_message": error_message}).eq("run_id", str(run_id)).execute()

    def run_backtest(self, forecast_run_id: UUID, metric: str | None = None) -> str:
        response = self.client.schema("core").rpc("run_backtest", {"p_forecast_run_id": str(forecast_run_id), "p_metric": metric}).execute()
        return str(response.data)
