import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ApiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.main = (ROOT / "app/main.py").read_text(encoding="utf-8") if (ROOT / "app/main.py").exists() else ""
        cls.repository = (ROOT / "app/repository.py").read_text(encoding="utf-8") if (ROOT / "app/repository.py").exists() else ""

    def test_required_endpoints_exist(self):
        for route in ["/forecast/run", "/backtest/run", "/models", "/health"]:
            self.assertIn(route, self.main)

    def test_forecast_reads_train_view_only(self):
        self.assertIn('schema("core").table("v_train_demand")', self.repository)
        self.assertNotIn("v_test_actual", self.repository)
        self.assertNotIn("raw.usage_history", self.repository)

    def test_failed_run_is_persisted(self):
        self.assertIn("FAILED", self.repository)
        self.assertIn("error_message", self.repository)


if __name__ == "__main__":
    unittest.main()
