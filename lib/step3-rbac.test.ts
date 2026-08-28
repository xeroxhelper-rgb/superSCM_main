import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20260828000200_step3_data_isolation.sql', import.meta.url);

test('STEP 3 RLS는 raw 직접 접근을 차단하고 view 조회만 허용한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /alter table if exists raw\.%I enable row level security/i);
  assert.match(sql, /revoke all privileges on all tables in schema raw from anon, authenticated/i);
  assert.match(sql, /grant select on core\.v_train_demand, core\.v_test_actual to authenticated/i);
});

test('정책과 Forecast 설정 mutation은 ADMIN 정책을 사용한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const table of ['policy_config', 'outlier_rule', 'item_policy', 'forecast_setting']) {
    assert.match(sql, new RegExp(`alter table core\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`core\\.${table}[\\s\\S]*core\\.is_admin\\(\\)`, 'i'));
  }
  assert.doesNotMatch(sql, /grant .* to anon.*(insert|update|delete)/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\)/i);
});
