import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Workflow 레거시 카드가 다크 셸 안에서 공통 다크 토큰을 사용한다', async () => {
  const css = await readFile(new URL('../styles/components.css', import.meta.url), 'utf8');
  assert.match(css, /\.design-content \.workflow-screen \.card[\s\S]*background:\s*var\(--color-surface\)/);
  assert.match(css, /\.design-content \.workflow-screen \.table-wrap[\s\S]*background:\s*var\(--color-surface\)/);
  assert.match(css, /\.design-content \.workflow-screen \.sample-input[\s\S]*background:\s*var\(--color-surface-high\)/);
  assert.match(css, /\.design-content \.workflow-screen \.report-preview[\s\S]*background:\s*var\(--color-surface-high\)/);
});
