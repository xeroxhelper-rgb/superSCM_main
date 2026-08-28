import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Lead Time 관리자 변경은 인증·RPC 경계를 사용한다', () => {
  const helper = read('./leadtime-policy-admin.ts');
  const action = read('../app/(admin)/admin/scm-policies/leadtime/actions.ts');
  assert.match(helper, /requireAdmin/);
  assert.match(helper, /admin_set_leadtime/);
  assert.match(action, /reason/);
  assert.doesNotMatch(helper, /NEXT_PUBLIC|SERVICE_ROLE|sb_secret/);
});

test('Lead Time 정책 화면은 정책 조회와 변경 이력을 제공한다', () => {
  const page = read('../app/(admin)/admin/scm-policies/leadtime/page.tsx');
  const table = read('../components/admin/leadtime-policy-table.tsx');
  assert.match(page, /getLeadtimePolicy/);
  assert.match(page, /getLeadtimePolicyHistory/);
  assert.match(table, /P80|p80/);
  assert.match(table, /effectiveLeadTime/);
  assert.match(table, /required/);
});
