import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260828000500_step6_forecast_engine.sql', import.meta.url);

test('Baseline 모델과 실행 함수가 요구된 계산 계약을 포함한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const model of ['MA_3M', 'MA_6M', 'WMA_3M', 'PY_SAME_MONTH', 'SEASONAL_NAIVE']) assert.match(sql, new RegExp(model));
  assert.match(sql, /run_baseline_forecast/);
  assert.match(sql, /stddev_samp/);
  assert.match(sql, /0\.841621/);
  assert.match(sql, /1\.281552/);
});

test('모델 계산은 부족한 이력을 0으로 보정하지 않는다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /INSUFFICIENT_HISTORY/);
  assert.match(sql, /NULL_TRAIN_INPUT/);
  assert.doesNotMatch(sql, /coalesce\([^\n]*predicted_qty[^\n]*,\s*0\)/i);
});
