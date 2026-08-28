import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20260828000200_step3_data_isolation.sql', import.meta.url);

test('train/test view는 설정 테이블의 경계만 사용한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create or replace view core\.v_train_demand/i);
  assert.match(sql, /create or replace view core\.v_test_actual/i);
  assert.match(sql, /train_start[\s\S]*train_end/);
  assert.match(sql, /test_start[\s\S]*test_end/);
  assert.match(sql, /u\.use_date between s\.train_start and s\.train_end/i);
  assert.match(sql, /u\.use_date between s\.test_start and s\.test_end/i);
  assert.doesNotMatch(sql, /'20\d{2}-\d{2}-\d{2}'/);
});

test('coverage와 관리자 view는 격리 상태와 정책값을 제공한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create or replace view analytics\.v_data_coverage/i);
  assert.match(sql, /train_row_count/i);
  assert.match(sql, /test_row_count/i);
  assert.match(sql, /train_window_ok/i);
  assert.match(sql, /test_window_ok/i);
  assert.match(sql, /create or replace view analytics\.v_forecast_setting_admin/i);
  assert.match(sql, /policy_values/i);
});
