import test from 'node:test';
import assert from 'node:assert/strict';
import { buildValidationErrorCsv, canRollback } from './history.ts';
import type { ImportHistoryRow } from './repository-types.ts';

test('오류 CSV는 ERROR와 WARNING 행만 원본 컬럼과 함께 출력한다', () => {
  const csv = buildValidationErrorCsv(
    [
      { rowNumber: 2, source: { 품목코드: 'ITEM001', 메모: 'a,b' }, normalized: {} },
      { rowNumber: 3, source: { 품목코드: 'ITEM002' }, normalized: {} },
    ],
    [
      { rowNumber: 2, fieldName: 'qty', errorCode: 'INVALID_NUMBER', errorMessage: '숫자 아님', severity: 'ERROR', originalValue: 'x' },
      { rowNumber: 3, fieldName: 'item_id', errorCode: 'UNKNOWN_ITEM', errorMessage: '품목 없음', severity: 'WARNING', originalValue: 'ITEM002' },
    ],
  );
  assert.match(csv, /row_number,error_code,error_message,severity/);
  assert.match(csv, /ITEM001/);
  assert.match(csv, /ITEM002/);
  assert.match(csv, /"a,b"/);
});

test('rollback은 관리자이며 reversible imported batch일 때만 가능하다', () => {
  const row = { status: 'IMPORTED', importMode: 'append' } as ImportHistoryRow;
  assert.equal(canRollback(row, true), true);
  assert.equal(canRollback(row, false), false);
  assert.equal(canRollback({ ...row, importMode: 'replace' }, true), false);
  assert.equal(canRollback({ ...row, status: 'FAILED' }, true), false);
});
