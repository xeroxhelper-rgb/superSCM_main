import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const migrationUrl = new URL('../supabase/migrations/20260828000600_step7_backtest_champion.sql', import.meta.url);
const pageUrl = new URL('../app/(user)/analysis/model-comparison/page.tsx', import.meta.url);
const viewUrl = new URL('../components/analysis/model-comparison-view.tsx', import.meta.url);
const migrationSource = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8') : '';
const pageSource = existsSync(pageUrl) ? readFileSync(pageUrl, 'utf8') : '';
const viewSource = existsSync(viewUrl) ? readFileSync(viewUrl, 'utf8') : '';

test('Backtest는 저장 Forecast Result와 검증 Actual만 사용한다', () => {
  assert.match(migrationSource, /analytics\.v_forecast_result|core\.forecast_result/i);
  assert.match(migrationSource, /core\.v_test_actual/i);
  assert.doesNotMatch(migrationSource, /raw\.usage_history/i);
  assert.doesNotMatch(migrationSource, /run_baseline_forecast/i);
});

test('비교 화면은 toggle에서 실행 RPC를 호출하지 않는다', () => {
  assert.match(viewSource, /ForecastOverlayChart/);
  assert.doesNotMatch(viewSource, /run_backtest|run_baseline_forecast|supabase\.rpc/i);
});
