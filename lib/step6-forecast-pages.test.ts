import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Forecast 관리자 route와 메뉴가 존재한다', () => {
  assert.ok(fs.existsSync('app/(admin)/admin/forecast-models/page.tsx'));
  assert.ok(fs.existsSync('app/(admin)/admin/forecast-runs/page.tsx'));
  const menu = fs.readFileSync('lib/menu.ts', 'utf8');
  assert.match(menu, /forecast-models/);
  assert.match(menu, /forecast-runs/);
});
