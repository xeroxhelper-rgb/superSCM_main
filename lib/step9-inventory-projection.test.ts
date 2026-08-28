import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const sql = readFileSync(new URL('../supabase/migrations/20260828000800_step9_inventory_projection.sql', import.meta.url), 'utf8');

test('STEP 9 migration은 Projection·Lead Time·Risk 객체를 정의한다', () => {
  for (const objectName of ['leadtime_policy_history', 'v_effective_lead_time', 'v_inventory_projection', 'v_stockout_risk', 'v_stockout_kpi', 'v_leadtime_policy']) {
    assert.match(sql, new RegExp(objectName));
  }
});

test('STEP 9 SQL은 Forecast·재고·입고·수주·가예약을 결합한다', () => {
  for (const source of ['v_forecast_result', 'champion_model', 'inventory', 'purchase_order', 'sales_order', 'business_event']) assert.match(sql, new RegExp(source, 'i'));
  assert.match(sql, /scheduled_receipt|scheduled_receipts/i);
  assert.match(sql, /soft_allocation/i);
  assert.match(sql, /CONFIRMED_ORDER_DEMAND_MODE/);
  assert.match(sql, /EXCLUSIVE/);
});

test('계산 불가 원인과 Risk 상태를 숫자 대체 없이 정의한다', () => {
  for (const reason of ['NO_INVENTORY_DATA', 'NO_FORECAST', 'NO_LEADTIME', 'INSUFFICIENT_SAMPLE']) assert.match(sql, new RegExp(reason));
  for (const status of ['SAFE', 'WARNING', 'CRITICAL', 'CALCULATION_UNAVAILABLE']) assert.match(sql, new RegExp(status));
  assert.match(sql, /planned_lead_time[\s\S]*(?:p80|p80[\s\S]*planned_lead_time)/i);
});

test('신규 Risk 계산은 raw 사용량 평균 나눗셈을 사용하지 않는다', () => {
  assert.doesNotMatch(sql, /raw\.usage_history/i);
  assert.match(sql, /ending_projected_inventory/);
  assert.match(sql, /stockout_period/);
  assert.match(sql, /days_of_supply/);
});
