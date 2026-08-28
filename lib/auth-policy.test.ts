import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRole,
  safeNextPath,
  defaultPathForRole,
  decideRouteAccess,
  assertAllowedAdminChange,
  normalizeProfile,
} from './auth-policy.ts';

test('DB 사용자 row를 안전한 profile로 정규화한다', () => {
  assert.deepEqual(normalizeProfile({ user_id: 'u1', email: 'u@example.com', name: '홍길동', department: null, role: 'ADMIN', active: true, last_login_at: null }), {
    userId: 'u1', email: 'u@example.com', name: '홍길동', department: null, role: 'ADMIN', active: true, lastLoginAt: null,
  });
  assert.equal(normalizeProfile({ user_id: '', email: 'u@example.com', name: '사용자', role: 'USER', active: true }), null);
  assert.equal(normalizeProfile({ user_id: 'u1', email: 'u@example.com', name: '사용자', role: 'OWNER', active: true }), null);
  assert.equal(normalizeProfile({ user_id: 'u1', email: 'u@example.com', name: '사용자', role: 'USER', active: false })?.active, false);
});

test('외부 URL과 로그인 순환 경로를 next로 허용하지 않는다', () => {
  assert.equal(safeNextPath('https://evil.example'), null);
  assert.equal(safeNextPath('//evil.example'), null);
  assert.equal(safeNextPath('/login?next=/admin'), null);
  assert.equal(safeNextPath('/analysis/leadtime?month=2026-09'), '/analysis/leadtime?month=2026-09');
});

test('로그인 경로의 slash 변형을 next로 허용하지 않는다', () => {
  assert.equal(safeNextPath('/login/'), null);
});

test('로그인 경로의 fragment 변형을 next로 허용하지 않는다', () => {
  assert.equal(safeNextPath('/login#fragment'), null);
});

test('백슬래시가 있는 next 경로를 허용하지 않는다', () => {
  assert.equal(safeNextPath('/\\evil.example'), null);
});

test('DB 역할만 ADMIN 또는 USER로 정규화한다', () => {
  assert.equal(normalizeRole('ADMIN'), 'ADMIN');
  assert.equal(normalizeRole('USER'), 'USER');
  assert.equal(normalizeRole('admin'), null);
  assert.equal(normalizeRole(undefined), null);
  assert.equal(defaultPathForRole('ADMIN'), '/admin');
  assert.equal(defaultPathForRole('USER'), '/');
});

test('미로그인은 원래 경로 로그인으로 보내고 USER의 admin 접근은 403 처리한다', () => {
  assert.deepEqual(
    decideRouteAccess({ pathname: '/analysis/leadtime', search: '?month=2026-09', authenticated: false, role: null, active: false }),
    { kind: 'redirect', location: '/login?next=%2Fanalysis%2Fleadtime%3Fmonth%3D2026-09' },
  );
  assert.deepEqual(
    decideRouteAccess({ pathname: '/admin/users', search: '', authenticated: true, role: 'USER', active: true }),
    { kind: 'forbidden' },
  );
  assert.deepEqual(
    decideRouteAccess({ pathname: '/admin/users', search: '', authenticated: true, role: 'ADMIN', active: true }),
    { kind: 'allow' },
  );
});

test('ADMIN은 자신의 권한 제거와 자기 비활성화를 할 수 없다', () => {
  assert.throws(() => assertAllowedAdminChange({ actorId: 'a', targetId: 'a', nextRole: 'USER' }), /자신의 관리자 권한/);
  assert.throws(() => assertAllowedAdminChange({ actorId: 'a', targetId: 'a', nextActive: false }), /자신의 계정/);
  assert.doesNotThrow(() => assertAllowedAdminChange({ actorId: 'a', targetId: 'b', nextRole: 'USER' }));
});
