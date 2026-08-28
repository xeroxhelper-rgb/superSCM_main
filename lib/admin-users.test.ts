import test from 'node:test';
import assert from 'node:assert/strict';
import { setUserActive, setUserRole } from './admin-users.ts';

test('자기 관리자 권한 제거는 DB RPC 호출 전에 거부한다', async () => {
  let called = false;
  await assert.rejects(setUserRole({ actorId: 'a', targetId: 'a', role: 'USER' }, async () => { called = true; }), /자신의 관리자 권한/);
  assert.equal(called, false);
});
test('자기 비활성화는 DB RPC 호출 전에 거부한다', async () => {
  let called = false;
  await assert.rejects(setUserActive({ actorId: 'a', targetId: 'a', active: false }, async () => { called = true; }), /자신의 계정/);
  assert.equal(called, false);
});
test('유효한 역할 변경은 mutation을 한 번 호출한다', async () => {
  let called = 0;
  await setUserRole({ actorId: 'a', targetId: 'b', role: 'ADMIN' }, async () => { called += 1; });
  assert.equal(called, 1);
});
