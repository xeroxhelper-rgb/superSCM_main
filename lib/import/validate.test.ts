import test from 'node:test';
import assert from 'node:assert/strict';
import { getImportSchema } from './schema.ts';
import { validateRows } from './validate.ts';

const schema = getImportSchema('usage_history');

test('필수값 누락·날짜·숫자·품목 오류를 ERROR로 기록하고 원본을 보존한다', () => {
  const result = validateRows([
    { rowNumber: 2, source: { 품목코드: 'UNKNOWN', 출고일: '잘못된날짜', 출고수량: '' }, normalized: { item_id: 'UNKNOWN', use_date: '잘못된날짜', qty: '' } },
  ], schema, { knownItems: new Set(['ITEM001']) });
  assert.equal(result.rows[0].status, 'ERROR');
  assert.ok(result.issues.some((issue) => issue.errorCode === 'INVALID_DATE'));
  assert.ok(result.issues.some((issue) => issue.errorCode === 'REQUIRED_VALUE_MISSING'));
  assert.ok(result.issues.some((issue) => issue.errorCode === 'UNKNOWN_ITEM'));
  assert.equal(result.issues.find((issue) => issue.errorCode === 'REQUIRED_VALUE_MISSING')?.originalValue, '');
});

test('중복·음수·날짜 관계 오류와 WARNING을 구분한다', () => {
  const result = validateRows([
    { rowNumber: 2, source: {}, normalized: { item_id: 'ITEM001', use_date: '2026-08-20', qty: '-2', warehouse: 'A' } },
    { rowNumber: 3, source: {}, normalized: { item_id: 'ITEM001', use_date: '2026-08-20', qty: '3', warehouse: 'A' } },
  ], schema, { knownItems: new Set(['ITEM001']), duplicateSeverity: 'WARNING' });
  assert.equal(result.rows[0].status, 'ERROR');
  assert.equal(result.rows[1].status, 'WARNING');
  assert.ok(result.issues.some((issue) => issue.errorCode === 'NEGATIVE_QUANTITY' && issue.severity === 'ERROR'));
  assert.ok(result.issues.some((issue) => issue.errorCode === 'DUPLICATE_SOURCE_ROW' && issue.severity === 'WARNING'));
});
