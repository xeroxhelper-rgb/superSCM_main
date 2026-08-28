import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Forecast 관리자 action은 requireAdmin과 RPC 경계를 사용한다', () => {
  for (const file of ['app/(admin)/admin/forecast-models/actions.ts', 'app/(admin)/admin/forecast-runs/actions.ts']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /requireAdmin/);
  }
  assert.match(fs.readFileSync('app/(admin)/admin/forecast-runs/actions.ts', 'utf8'), /run_baseline_forecast/);
});
