import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { getImportSchema } from './schema.ts';
import { parseImportFile } from './parse.ts';

test('import registry는 실제 지원 타입과 필수 컬럼을 제공한다', () => {
  const schema = getImportSchema('usage_history');
  assert.equal(schema.targetTable, 'usage_history');
  assert.ok(schema.requiredFields.includes('item_id'));
  assert.ok(schema.requiredFields.includes('use_date'));
  assert.ok(schema.requiredFields.includes('qty'));
  assert.equal(getImportSchema('sales_order').targetTable, 'sales_order');
});

test('CSV parser는 원본 헤더와 행 값을 보존한다', async () => {
  const file = new File(['품목코드,출고일,출고수량\nITEM001,2026-08-20,12'], 'demand.csv', { type: 'text/csv' });
  const parsed = await parseImportFile(file, 'usage_history');
  assert.deepEqual(parsed.headers, ['품목코드', '출고일', '출고수량']);
  assert.deepEqual(parsed.rows[0], { 품목코드: 'ITEM001', 출고일: '2026-08-20', 출고수량: '12' });
  assert.equal(parsed.totalRows, 1);
});

test('XLSX parser는 첫 번째 시트를 행 데이터로 읽는다', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['품목코드', '출고일', '출고수량'],
    ['ITEM002', '2026-08-21', 4],
  ]), 'Sheet1');
  const file = new File([XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })], 'demand.xlsx');
  const parsed = await parseImportFile(file, 'usage_history');
  assert.deepEqual(parsed.rows[0], { 품목코드: 'ITEM002', 출고일: '2026-08-21', 출고수량: '4' });
});

test('지원하지 않는 확장자와 빈 파일은 거부한다', async () => {
  await assert.rejects(() => parseImportFile(new File(['x'], 'data.txt'), 'usage_history'), /지원하지 않는 파일 형식/);
  await assert.rejects(() => parseImportFile(new File([''], 'empty.csv'), 'usage_history'), /비어 있습니다/);
});
