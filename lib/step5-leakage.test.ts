import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('STEP 5 애플리케이션 코드에 raw/test 조회가 없다', () => {
  for (const file of ['lib/scm.ts', 'app/(user)/analysis/demand-profile/page.tsx', 'components/analysis/demand-profile-table.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /raw\.usage_history|core\.v_test_actual/);
  }
});

test('계산 불가 값은 숫자 0으로 대체되지 않는다', () => {
  const source = fs.readFileSync('components/analysis/demand-profile-table.tsx', 'utf8');
  assert.match(source, /EmptyValue/);
  assert.doesNotMatch(source, /\?\? 0/);
});
