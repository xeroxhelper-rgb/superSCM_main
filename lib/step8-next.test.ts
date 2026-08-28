import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('Next.js Python Forecast 경계는 관리자·서버 전용이다', () => {
  const helper = read('./python-forecast-admin.ts');
  const action = read('../app/(admin)/admin/python-forecast/actions.ts');
  assert.match(helper, /requireAdmin/);
  assert.match(action, /requireAdmin/);
  assert.match(helper, /FORECAST_SERVICE_TOKEN/);
  assert.doesNotMatch(helper, /NEXT_PUBLIC/);
  assert.doesNotMatch(read('../components/admin/python-forecast-panel.tsx'), /FORECAST_SERVICE_TOKEN|SUPABASE_SERVICE_ROLE_KEY/);
});
