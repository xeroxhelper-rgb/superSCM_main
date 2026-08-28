import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../supabase/migrations/20260828000300_step4_import_pipeline.sql', import.meta.url);

test('수요 관련 import는 forecast 결과를 삭제하지 않고 stale 후보 view를 제공한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /create or replace view analytics\.v_import_stale_candidates/i);
  assert.match(sql, /usage_history/);
  assert.match(sql, /stale/i);
  assert.doesNotMatch(sql, /delete\s+from\s+.*forecast/i);
});

test('import 적재는 batch 추적 컬럼을 채우고 지원 타입 registry와 일치한다', async () => {
  const [sql, schema] = await Promise.all([
    readFile(migrationPath, 'utf8'),
    readFile(new URL('./import/schema.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(sql, /source_type.*FILE_UPLOAD/i);
  assert.match(sql, /source_record_id/i);
  for (const type of ['usage_history', 'inventory', 'item_master', 'supplier_master', 'purchase_order', 'goods_receipt', 'sales_order', 'business_event']) assert.match(schema, new RegExp(type));
});

test('upsert import는 business key 기준으로 기존 행을 대체한다', async () => {
  const sql = await readFile(migrationPath, 'utf8');
  assert.match(sql, /if\s+b\.import_mode\s*=\s*'upsert'/i);
  assert.match(sql, /delete from raw\.usage_history/i);
  assert.match(sql, /delete from raw\.sales_order/i);
});

test('import route와 component는 raw 테이블을 직접 insert하지 않는다', async () => {
  const files = [
    new URL('../app/api/import/parse/route.ts', import.meta.url),
    new URL('../app/api/import/validate/route.ts', import.meta.url),
    new URL('../app/api/import/confirm/route.ts', import.meta.url),
    new URL('../components/admin/import-wizard.tsx', import.meta.url),
  ];
  const sources = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  assert.ok(sources.every((source) => !/\.from\(['"](usage_history|inventory|item_master|supplier_master|purchase_order|goods_receipt|sales_order|business_event)['"]\)\.insert/i.test(source)));
});
