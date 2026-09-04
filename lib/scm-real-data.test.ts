import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBomRequirement,
  normalizeDemandProfileRt,
  normalizeOlAccuracy,
  normalizeShipmentTrend,
} from './scm-model.ts';

test('실출하 추세 행을 화면 모델로 정규화한다', () => {
  assert.deepEqual(normalizeShipmentTrend({
    item_code: '602K02693',
    item_name: '테스트 품목',
    period: '2026-08',
    shipment_count: 40,
    shipped_qty: 779.0,
    average_qty: 772.3,
    reason_code: null,
  }), {
    itemCode: '602K02693',
    itemName: '테스트 품목',
    period: '2026-08',
    shipmentCount: 40,
    shippedQty: 779,
    averageQty: 772.3,
    trend: null,
    reasonCode: null,
  });
});

test('수요 프로파일은 null 지표와 reason code를 보존한다', () => {
  const result = normalizeDemandProfileRt({ item_code: 'ITEM020', demand_type: null, adi: null, reason_code: 'NO_USAGE_HISTORY' });
  assert.equal(result.itemCode, 'ITEM020');
  assert.equal(result.demandType, null);
  assert.equal(result.adi, null);
  assert.equal(result.reasonCode, 'NO_USAGE_HISTORY');
});

test('OL 정확도와 회계연도 행을 같은 모델로 정규화한다', () => {
  const result = normalizeOlAccuracy({ model_base: 'MA_3M', fiscal_year: '2026', wape: 0.12, mape: null, bias: -4.5 });
  assert.equal(result.modelBase, 'MA_3M');
  assert.equal(result.fiscalYear, '2026');
  assert.equal(result.wape, 0.12);
  assert.equal(result.mape, null);
  assert.equal(result.bias, -4.5);
});

test('BOM 요구량은 품목과 구성품 식별자를 정규화한다', () => {
  const result = normalizeBomRequirement({ model_base: '2026.09', item_code: '602K02693', component_item_code: 'PART001', required_qty: 12, reason_code: null });
  assert.equal(result.modelBase, '2026.09');
  assert.equal(result.itemCode, '602K02693');
  assert.equal(result.componentItemCode, 'PART001');
  assert.equal(result.requiredQty, 12);
  assert.equal(result.reasonCode, null);
});
