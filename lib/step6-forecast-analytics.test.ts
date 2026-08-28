import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260828000500_step6_forecast_engine.sql', import.meta.url);

test('Forecast analytics view와 stale 필드를 정의한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const view of ['analytics.v_model_config', 'analytics.v_forecast_run', 'analytics.v_forecast_result', 'analytics.v_forecast_run_kpi']) assert.match(sql, new RegExp(view.replace('.', '\\.'), 'i'));
  assert.match(sql, /is_stale/);
  assert.match(sql, /data_snapshot_at/);
});
