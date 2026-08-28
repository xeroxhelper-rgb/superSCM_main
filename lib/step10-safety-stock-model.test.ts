import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSafetyStockTrace, normalizePurchaseRecommendation } from './step10-safety-stock-model.ts';

test('Forecast와 확정수주 중 큰 값을 demand basis로 사용한다', () => {
  const result = calculateSafetyStockTrace({ forecastQty: 100, confirmedOrderQty: 140, leadTime: 10, demandPerPeriod: 20, demandSigma: 3, leadTimeSigma: 2, zValue: 1.645, availableInventory: 50, scheduledReceipt: 20, moq: 30, packSize: 20 });
  assert.equal(result.demandBasisQty, 140);
  assert.equal(result.safetyStock, 67.63);
});

test('Required Qty가 양수이면 MOQ와 Pack Size를 순서대로 적용한다', () => {
  const result = calculateSafetyStockTrace({ forecastQty: 135, confirmedOrderQty: 0, leadTime: 10, demandPerPeriod: 135, demandSigma: 0, leadTimeSigma: 0, zValue: 1.645, availableInventory: 0, scheduledReceipt: 0, moq: 30, packSize: 20 });
  assert.equal(result.requiredQty, 135);
  assert.equal(result.recommendedQty, 140);
});

test('Required Qty가 0 이하이면 계산된 발주 불필요로 구분한다', () => {
  const result = calculateSafetyStockTrace({ forecastQty: 10, confirmedOrderQty: 0, leadTime: 10, demandPerPeriod: 10, demandSigma: 0, leadTimeSigma: 0, zValue: 1.645, availableInventory: 20, scheduledReceipt: 0, moq: 30, packSize: 20 });
  assert.equal(result.recommendedQty, 0);
  assert.equal(result.calculationStatus, 'CALCULATED_NO_ORDER');
});

test('필수 입력이 없으면 추천수량을 0으로 보정하지 않는다', () => {
  const result = calculateSafetyStockTrace({ forecastQty: null, confirmedOrderQty: 0, leadTime: null, demandPerPeriod: null, demandSigma: null, leadTimeSigma: null, zValue: null, availableInventory: 10, scheduledReceipt: 0, moq: 30, packSize: 20 });
  assert.equal(result.recommendedQty, null);
  assert.equal(result.calculationStatus, 'CALCULATION_UNAVAILABLE');
  assert.ok(result.reasonCodes.includes('NO_FORECAST'));
  assert.ok(result.reasonCodes.includes('NO_LEADTIME'));
});

test('추천 View의 계산불가 값과 trace 컬럼을 보존한다', () => {
  const result = normalizePurchaseRecommendation({ item_id: 'ITEM001', recommended_qty: null, calculation_status: 'CALCULATION_UNAVAILABLE', reason_code: 'NO_SERVICE_LEVEL', demand_basis_qty: null, safety_stock: null });
  assert.equal(result.itemId, 'ITEM001');
  assert.equal(result.recommendedQty, null);
  assert.equal(result.reasonCode, 'NO_SERVICE_LEVEL');
  assert.equal(result.demandBasisQty, null);
});
