import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20260828000200_step3_data_isolation.sql', import.meta.url);

test('STEP 3 migration은 raw 입력 추적 컬럼과 신규 입력 테이블을 정의한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  for (const table of ['shipment_log', 'supplier_master', 'item_master', 'inventory', 'usage_history', 'forecast', 'goods_receipt', 'purchase_order']) assert.match(sql, new RegExp(`'${table}'`));
  for (const table of ['business_event', 'sales_order', 'item_substitute']) assert.match(sql, new RegExp(`raw\\.${table}`));
  assert.match(sql, /raw\.%I/);
  for (const column of ['batch_id', 'source_type', 'loaded_at', 'source_record_id']) assert.match(sql, new RegExp(column));
  for (const table of ['policy_config', 'outlier_rule', 'item_policy', 'forecast_setting']) assert.match(sql, new RegExp(`core\\.${table}`));
  for (const column of ['train_start', 'train_end', 'test_start', 'test_end', 'granularity']) assert.match(sql, new RegExp(column));
});
