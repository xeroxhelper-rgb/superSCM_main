import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(new URL('../supabase/migrations/20260828000700_step8_python_forecast.sql', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../services/forecast-python/app/repository.py', import.meta.url), 'utf8');
const service = readFileSync(new URL('../services/forecast-python/app/service.py', import.meta.url), 'utf8');
const config = readFileSync(new URL('../services/forecast-python/app/config.py', import.meta.url), 'utf8');

test('Python 모델이 STEP 6/7 저장 구조에 연결된다', () => {
  for (const model of ['PY_ETS', 'PY_HOLT', 'PY_HOLT_WINTERS', 'PY_CROSTON', 'PY_SBA', 'PY_TSB', 'PY_SARIMA', 'PY_PROPHET', 'PY_XGBOOST']) assert.match(migration, new RegExp(model));
  for (const column of ['run_id', 'model_version', 'item_id', 'period', 'predicted_qty', 'p50', 'p80', 'p90']) assert.match(repository + service + migration, new RegExp(column));
  assert.match(migration, /engine in \('SQL','PYTHON'\)/);
});

test('Python Forecast 저장소는 학습 view만 읽고 service role을 서버에 둔다', () => {
  assert.match(repository, /core.*v_train_demand/);
  assert.doesNotMatch(repository, /v_test_actual|raw\.usage_history/);
  assert.match(config, /SUPABASE_SERVICE_ROLE_KEY/);
});
