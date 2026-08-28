import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sql = fs.readFileSync('supabase/migrations/20260828000400_step5_demand_profile.sql', 'utf8');

test('프로파일 view가 학습 view를 사용하고 raw/test view를 직접 사용하지 않는다', () => {
  assert.match(sql, /core\.v_train_demand/);
  assert.doesNotMatch(sql, /raw\.usage_history/);
  assert.doesNotMatch(sql, /core\.v_test_actual/);
});

test('필수 profile과 KPI 객체 및 demand type 코드가 존재한다', () => {
  assert.match(sql, /analytics\.v_sku_demand_profile/);
  assert.match(sql, /analytics\.v_demand_profile_kpi/);
  for (const code of ['SMOOTH', 'INTERMITTENT', 'ERRATIC', 'LUMPY']) assert.match(sql, new RegExp(code));
});
