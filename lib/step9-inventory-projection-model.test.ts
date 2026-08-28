import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyProjectionRisk } from './step9-inventory-projection-model.ts';

test('재고가 충분하면 SAFE를 반환한다', () => assert.equal(classifyProjectionRisk({ stockoutPeriod: null, leadTimeDays: 20, stockoutLeadDays: null }), 'SAFE'));
test('Lead Time 이후 소진이면 현재 발주로 대응 가능한 WARNING이다', () => assert.equal(classifyProjectionRisk({ stockoutPeriod: '2026-09-20', leadTimeDays: 30, stockoutLeadDays: 40 }), 'WARNING'));
test('예상 입고보다 먼저 소진되면 CRITICAL이다', () => assert.equal(classifyProjectionRisk({ stockoutPeriod: '2026-09-10', leadTimeDays: 30, stockoutLeadDays: 10 }), 'CRITICAL'));
test('필수 값이 없으면 계산 불가 상태다', () => assert.equal(classifyProjectionRisk({ stockoutPeriod: null, leadTimeDays: null, stockoutLeadDays: null }), 'CALCULATION_UNAVAILABLE'));
