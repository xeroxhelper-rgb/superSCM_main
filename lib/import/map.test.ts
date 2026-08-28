import test from 'node:test';
import assert from 'node:assert/strict';
import { applyColumnMapping, inferColumnMapping } from './map.ts';
import { getImportSchema } from './schema.ts';

test('한국어 헤더를 표준 컬럼으로 자동 추정한다', () => {
  const mapping = inferColumnMapping(['품목코드', '출고일', '출고수량'], getImportSchema('usage_history'));
  assert.deepEqual(mapping.map((entry) => entry.targetColumn), ['item_id', 'use_date', 'qty']);
  assert.ok(mapping.every((entry) => entry.confidence > 0));
});

test('컬럼 매핑은 원본 행과 매핑되지 않은 값을 보존한다', () => {
  const mapped = applyColumnMapping(
    { 품목코드: 'ITEM001', 출고일: '2026-08-20', 비고: '원본' },
    [
      { sourceColumn: '품목코드', targetColumn: 'item_id', confidence: 1 },
      { sourceColumn: '출고일', targetColumn: 'use_date', confidence: 1 },
    ],
  );
  assert.deepEqual(mapped.normalized, { item_id: 'ITEM001', use_date: '2026-08-20' });
  assert.equal(mapped.source['비고'], '원본');
});
