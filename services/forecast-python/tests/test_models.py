import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ModelContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = (ROOT / "app/models/base.py").read_text(encoding="utf-8") if (ROOT / "app/models/base.py").exists() else ""
        cls.builtin = (ROOT / "app/models/builtin.py").read_text(encoding="utf-8") if (ROOT / "app/models/builtin.py").exists() else ""
        cls.registry = (ROOT / "app/models/registry.py").read_text(encoding="utf-8") if (ROOT / "app/models/registry.py").exists() else ""

    def test_common_forecast_interface_and_output_columns(self):
        self.assertIn("forecast(train_df, horizon, params)", self.base)
        for column in ["period", "predicted_qty", "p50", "p80", "p90", "reason_code"]:
            self.assertIn(column, self.base)

    def test_builtin_and_intermittent_models_are_registered(self):
        for model_id in ["PY_ETS", "PY_HOLT", "PY_HOLT_WINTERS", "PY_CROSTON", "PY_SBA", "PY_TSB"]:
            self.assertIn(model_id, self.registry)
            self.assertIn(model_id, self.builtin)

    def test_optional_models_are_lazy_loaded(self):
        for model_id in ["PY_SARIMA", "PY_PROPHET", "PY_XGBOOST"]:
            self.assertIn(model_id, self.registry)
        self.assertIn("import_module", self.registry)


if __name__ == "__main__":
    unittest.main()
