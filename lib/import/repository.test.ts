import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toStagingInsertRows, normalizeUploadBatchRow } from './repository-core.ts';

test('staging payload는 raw insert 없이 원본과 매핑 JSON을 보존한다', () => {
  const rows = toStagingInsertRows('batch-1', [
    { rowNumber: 2, source: { 품목코드: 'ITEM001' }, normalized: { item_id: 'ITEM001' } },
  ]);
  assert.deepEqual(rows[0], { batch_id: 'batch-1', row_number: 2, raw_data: { 품목코드: 'ITEM001' }, mapped_data: { item_id: 'ITEM001' } });
});

test('history row는 DB count와 사용자 정보를 화면 계약으로 정규화한다', () => {
  const row = normalizeUploadBatchRow({ batch_id: 'b', file_name: 'a.csv', total_rows: '3', success_rows: 2, warning_rows: 1, error_rows: 0, status: 'IMPORTED', uploaded_by_email: null });
  assert.equal(row.totalRows, 3);
  assert.equal(row.successRows, 2);
  assert.equal(row.uploader, '알 수 없음');
});

test('repository는 raw 테이블에 직접 insert하지 않는다', async () => {
  const source = await readFile(new URL('./repository.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.from\(['"](usage_history|inventory|item_master|supplier_master|purchase_order|goods_receipt|sales_order|business_event)['"]\)\.insert/i);
});
