import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStockoutRisk } from './scm-model.ts';

test('normalizes stockout risk without replacing unavailable values with zero', () => {
  const result = normalizeStockoutRisk({
    item_id: 'ITEM020',
    item_name: '사용 이력 없는 품목',
    supplier_id: 'SUP020',
    current_stock: 20,
    inbound_qty: 0,
    available_qty: 20,
    daily_usage_avg: null,
    planned_lead_time: null,
    stockout_days: null,
    stockout_date: null,
    risk_status: 'UNKNOWN',
    reason: 'NO_USAGE',
  });

  assert.equal(result.stockoutDays, null);
  assert.equal(result.stockoutDate, null);
  assert.equal(result.riskStatus, 'CALCULATION_UNAVAILABLE');
  assert.equal(result.reason, 'NO_USAGE');
});

test('preserves safe and critical stockout statuses from analytics', () => {
  assert.equal(normalizeStockoutRisk({ item_id: 'ITEM001', risk_status: 'SAFE' }).riskStatus, 'SAFE');
  assert.equal(normalizeStockoutRisk({ item_id: 'ITEM002', risk_status: 'CRITICAL' }).riskStatus, 'CRITICAL');
});
