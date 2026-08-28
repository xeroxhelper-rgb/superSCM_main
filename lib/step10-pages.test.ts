import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Purchase Recommendation 목록과 상세 route가 존재한다', async () => {
  const list = await readFile(new URL('../app/(user)/analysis/purchase-recommendation/page.tsx', import.meta.url), 'utf8');
  const detail = await readFile(new URL('../app/(user)/analysis/purchase-recommendation/[itemId]/page.tsx', import.meta.url), 'utf8');
  assert.match(list, /getPurchaseRecommendations/);
  assert.match(list, /PurchaseRecommendationTable/);
  assert.match(detail, /getPurchaseRecommendation/);
});

test('추천 표는 계산불가 값을 공통 EmptyValue로 표시한다', async () => {
  const table = await readFile(new URL('../components/analysis/purchase-recommendation-table.tsx', import.meta.url), 'utf8');
  assert.match(table, /EmptyValue/);
  assert.match(table, /recommendedQty/);
  assert.match(table, /recommendedOrderDate/);
});
