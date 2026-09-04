import test from 'node:test';
import assert from 'node:assert/strict';
import { agentTools, makeToolResult } from './tools.ts';

test('Agent Tool 이름은 유일하고 네 개다', () => {
  const names = agentTools.map((tool) => tool.name);
  assert.deepEqual(names, ['getShipmentTrend', 'getDemandProfile', 'getOlAccuracy', 'getBomRequirement']);
  assert.equal(new Set(names).size, names.length);
});

test('모든 Agent Tool 파라미터 Schema는 strict 객체이며 추가 속성을 거부한다', () => {
  for (const tool of agentTools) {
    const schema = tool.parameters as { type: string; additionalProperties: boolean; required: string[] };
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
    assert.ok(Array.isArray(schema.required));
  }
});

test('모든 Agent Tool은 USER와 ADMIN 역할을 명시한다', () => {
  for (const tool of agentTools) assert.deepEqual(tool.roles, ['USER', 'ADMIN']);
});

test('없는 품목은 숫자를 만들지 않고 명시적인 사유를 반환한다', () => {
  const result = makeToolResult([], null, 'ITEM_NOT_FOUND');
  assert.equal(result.ok, false);
  assert.deepEqual(result.data, []);
  assert.deepEqual(result.numbers, []);
  assert.equal(result.reason, 'ITEM_NOT_FOUND');
});

test('NULL 지표는 numbers에 0으로 추가하지 않고 데이터와 사유를 보존한다', () => {
  const result = makeToolResult([{ quantity: null, wape: 0.12, reason_code: 'NO_ACTUAL' }], '2026-09-04');
  assert.equal(result.ok, true);
  assert.deepEqual(result.numbers, [0.12]);
  assert.equal(result.dataAsOf, '2026-09-04');
  assert.equal(result.reason, 'NO_ACTUAL');
});

test('잘못된 Tool 인자는 Supabase 호출 없이 거부한다', async () => {
  const tool = agentTools.find((candidate) => candidate.name === 'getShipmentTrend');
  assert.ok(tool);
  const result = await tool.run({ itemCode: '' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'INVALID_PARAMETERS');
});
