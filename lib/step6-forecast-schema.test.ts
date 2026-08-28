import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260828000500_step6_forecast_engine.sql', import.meta.url);
const readMigration = () => readFile(migrationPath, 'utf8');

test('Forecast migration은 registry/version/run/result 객체를 정의한다', async () => {
  const sql = await readMigration();
  for (const object of ['core.model_config', 'core.model_version', 'core.forecast_run', 'core.forecast_result']) assert.match(sql, new RegExp(object.replace('.', '\\.'), 'i'));
  for (const column of ['model_id', 'model_version', 'predicted_qty', 'p50', 'p80', 'p90', 'sigma', 'data_snapshot_at', 'triggered_by']) assert.match(sql, new RegExp(column, 'i'));
});

test('Forecast SQL은 train view만 사용하고 test/raw 직접 조회를 금지한다', async () => {
  const sql = await readMigration();
  assert.match(sql, /core\.v_train_demand/);
  assert.doesNotMatch(sql, /raw\.usage_history/);
  assert.doesNotMatch(sql, /core\.v_test_actual/);
});
