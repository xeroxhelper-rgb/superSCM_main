import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Forecast 앱 코드에 raw/test 직접 조회가 없다', () => {
  for (const file of ['lib/forecast-admin.ts', 'app/(admin)/admin/forecast-models/page.tsx', 'app/(admin)/admin/forecast-runs/page.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /raw\.usage_history|core\.v_test_actual/);
  }
});

test('Forecast 결과 저장 경계는 run_id와 model_version을 요구한다', () => {
  const sql = fs.readFileSync('supabase/migrations/20260828000500_step6_forecast_engine.sql', 'utf8');
  assert.match(sql, /run_id[\s\S]*model_version/);
  assert.match(sql, /p80[\s\S]*sigma/);
});
