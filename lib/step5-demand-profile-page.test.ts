import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('수요 프로파일 route와 메뉴가 존재한다', () => {
  assert.ok(fs.existsSync('app/(user)/analysis/demand-profile/page.tsx'));
  assert.match(fs.readFileSync('lib/menu.ts', 'utf8'), /demand-profile/);
});

test('페이지는 raw usage를 직접 조회하지 않는다', () => {
  const source = fs.readFileSync('app/(user)/analysis/demand-profile/page.tsx', 'utf8');
  assert.doesNotMatch(source, /raw\.usage_history|core\.v_train_demand|core\.v_test_actual/);
});
