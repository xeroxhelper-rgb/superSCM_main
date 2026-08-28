import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Inventory Projection route와 메뉴가 존재한다', () => {
  const page = read('../app/(user)/analysis/inventory-projection/page.tsx');
  const menu = read('./menu.ts');
  assert.match(page, /getInventoryProjection/);
  assert.match(menu, /inventory-projection/);
});

test('Projection 화면은 공통 EmptyValue·DataTable을 사용한다', () => {
  const table = read('../components/analysis/inventory-projection-table.tsx');
  assert.match(table, /EmptyValue/);
  assert.match(table, /DataTable/);
  assert.doesNotMatch(table, /reduce\(|Math\.(max|min|round)/i);
});

test('Stockout 정규화는 Projection 결과 컬럼을 보존한다', () => {
  const model = read('./scm-model.ts');
  assert.match(model, /stockoutPeriod/);
  assert.match(model, /daysOfSupply/);
  assert.match(model, /monthsOfSupply/);
});
