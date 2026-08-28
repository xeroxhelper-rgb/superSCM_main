import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('STEP 10 migration은 Safety Stock과 Purchase Recommendation 객체를 정의한다', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260828000900_step10_safety_stock_purchase.sql', import.meta.url), 'utf8');
  for (const objectName of ['analytics.v_safety_stock', 'analytics.v_purchase_recommendation', 'analytics.v_purchase_recommendation_detail']) assert.match(sql, new RegExp(objectName.replace('.', '\\.'), 'i'));
  for (const column of ['sigma_dlt', 'safety_stock', 'demand_basis_qty', 'recommended_qty', 'recommended_order_date', 'calculation_status', 'reason_code']) assert.match(sql, new RegExp(column, 'i'));
});

test('STEP 10 SQL은 모든 계산불가 사유와 SQL 계산식을 보존한다', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260828000900_step10_safety_stock_purchase.sql', import.meta.url), 'utf8');
  for (const code of ['NO_FORECAST', 'NO_INVENTORY_DATA', 'NO_LEADTIME', 'INSUFFICIENT_FORECAST_ERROR', 'NO_SERVICE_LEVEL', 'NO_ITEM_POLICY']) assert.match(sql, new RegExp(code));
  assert.match(sql, /sqrt\(/i);
  assert.match(sql, /ceil\(/i);
  assert.doesNotMatch(sql, /raw\.usage_history/i);
});
