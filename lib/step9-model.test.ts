import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeInventoryProjection, normalizeLeadtimePolicy } from './scm-model.ts';

test('Projection 정규화는 null과 reason code를 숫자로 바꾸지 않는다', () => {
  const row = normalizeInventoryProjection({ item_id: 'ITEM001', ending_projected_inventory: null, risk_status: 'CALCULATION_UNAVAILABLE', reason_code: 'NO_FORECAST' });
  assert.equal(row.endingProjectedInventory, null);
  assert.equal(row.reasonCode, 'NO_FORECAST');
});

test('Lead Time 정책 정규화는 관리자 확정값과 P80을 구분한다', () => {
  const row = normalizeLeadtimePolicy({ supplier_id: 'SUP001', p80_days: 42, confirmed_lead_time: 35, effective_lead_time: 35, effective_source: 'ADMIN_CONFIRMED' });
  assert.equal(row.confirmedLeadTime, 35);
  assert.equal(row.p80, 42);
  assert.equal(row.effectiveSource, 'ADMIN_CONFIRMED');
});
