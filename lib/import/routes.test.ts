import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../app/api/import/', import.meta.url);

async function source(name: string) {
  return readFile(new URL(`${name}/route.ts`, root), 'utf8');
}

test('모든 import route는 인증 helper와 서버 repository 경계를 사용한다', async () => {
  for (const name of ['parse', 'validate', 'confirm', 'rollback']) {
    const sql = await source(name);
    assert.match(sql, /require(User|Admin)\(\)/);
    assert.doesNotMatch(sql, /\.from\(['"](usage_history|inventory|item_master|supplier_master|purchase_order|goods_receipt|sales_order|business_event)['"]\)\.insert/);
  }
});

test('confirm과 rollback은 DB RPC를 통해서만 최종 변경한다', async () => {
  const confirm = await source('confirm');
  const rollback = await source('rollback');
  assert.match(confirm, /importBatch\(/);
  assert.match(rollback, /requireAdmin\(\)/);
  assert.match(rollback, /rollbackBatch\(/);
  assert.match(confirm, /confirmed/);
});
