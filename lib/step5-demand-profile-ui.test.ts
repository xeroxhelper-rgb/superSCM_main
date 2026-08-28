import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('필터 UI는 요구된 필터 이름과 DB 코드값을 포함한다', () => {
  const source = fs.readFileSync('components/analysis/demand-profile-filters.tsx', 'utf8');
  assert.match(source, /Demand Type/);
  assert.match(source, /계산 가능/);
  assert.match(source, /SKU/);
  assert.match(source, /INTERMITTENT/);
});

test('표 UI는 EmptyValue와 공통 Badge를 사용한다', () => {
  const source = fs.readFileSync('components/analysis/demand-profile-table.tsx', 'utf8');
  assert.match(source, /EmptyValue/);
  assert.match(source, /Badge/);
});
