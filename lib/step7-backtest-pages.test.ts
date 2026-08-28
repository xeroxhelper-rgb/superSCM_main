import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('ADMIN Backtest와 Champion 화면 및 action이 존재한다', () => {
  assert.match(source('../app/(admin)/admin/backtest-runs/page.tsx'), /getBacktestRuns|runBacktestAction/);
  assert.match(source('../app/(admin)/admin/champions/page.tsx'), /getChampions/);
  assert.match(source('../app/(admin)/admin/champions/actions.ts'), /requireAdmin/);
  assert.match(source('../components/admin/champions-table.tsx'), /required/);
});
