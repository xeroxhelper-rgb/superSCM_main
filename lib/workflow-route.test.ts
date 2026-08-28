import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const file = (path: string) => new URL(path, import.meta.url);

test('WORKFLOW는 사용자 셸 라우트이고 레거시 화면은 별도 경로로 격리된다', () => {
  assert.equal(existsSync(file('../app/(user)/workflow/page.tsx')), true);
  assert.equal(existsSync(file('../app/(legacy)/legacy/workflow/page.tsx')), true);
  assert.equal(existsSync(file('../app/(legacy)/workflow/page.tsx')), false);
});

test('사용자 WORKFLOW 라우트는 레거시 ProcurementApp 셸을 렌더링하지 않는다', () => {
  const page = readFileSync(file('../app/(user)/workflow/page.tsx'), 'utf8');
  const screen = readFileSync(file('../components/workflow/workflow-screen.tsx'), 'utf8');
  assert.doesNotMatch(page, /ProcurementApp/);
  assert.match(screen, /DemandStep|SupplyStep|MasterStep|CalculationStep|ReportStep/);
});
