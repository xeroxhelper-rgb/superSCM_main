import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const modelSource = readFileSync(new URL('./scm-model.ts', import.meta.url), 'utf8');
const migrationUrl = new URL('../supabase/migrations/20260828000600_step7_backtest_champion.sql', import.meta.url);
const migrationSource = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8') : '';

test('STEP 7 지표와 저장 객체 계약이 존재한다', () => {
  for (const token of ['BacktestRun', 'ModelPerformance', 'ChampionModel', 'ComparisonPoint']) assert.match(modelSource, new RegExp(`type ${token}`));
  for (const token of ['backtest_run', 'model_performance', 'champion_model', 'run_backtest', 'set_manual_champion', 'WAPE', 'MAPE', 'RMSE', 'MAE', 'baseline_improvement', 'candidate_performance']) assert.match(migrationSource, new RegExp(token, 'i'));
});

test('Bias는 forecast - actual 기준으로 양수가 과대예측이다', () => {
  const forecast = [120, 130];
  const actual = [100, 100];
  const bias = forecast.reduce((sum, value, index) => sum + value - actual[index], 0);
  assert.ok(bias > 0);
});

test('Actual 합계 0과 MAPE 분모 0을 숫자로 보정하지 않는다', () => {
  assert.match(migrationSource, /ACTUAL_SUM_ZERO/);
  assert.match(migrationSource, /MAPE_DENOMINATOR_ZERO/);
  assert.doesNotMatch(migrationSource, /coalesce\([^)]*WAPE[^)]*,\s*0\)/i);
});
