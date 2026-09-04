import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentAnswer } from './schema.ts';
import type { ToolResult } from './tools.ts';
import { buildAllowedNumbers, extractAnswerNumbers, validateAnswerNumbers } from './guardrail.ts';

const baseAnswer = (overrides: Partial<AgentAnswer> = {}): AgentAnswer => ({
  answer: '출고량은 1,250개이고 정확도는 12.5%입니다.',
  verdict: 'SUPPORTED',
  evidence: [{ source: 'shipment', source_type: 'view', source_id: null, claim: '평균은 -3.25입니다.', value: '0.125', data_as_of: null }],
  data_as_of: null,
  risk: 'SAFE',
  recommended_action: '2026-07 기준으로 20개를 검토하세요.',
  cannot_answer: false,
  cannot_answer_reason: null,
  ...overrides,
});

const result = (data: unknown, numbers: number[]): ToolResult => ({ ok: true, data, numbers, dataAsOf: null, reason: null });

test('정상 숫자와 천단위 쉼표를 허용한다', () => {
  const found = extractAnswerNumbers(baseAnswer());
  assert.deepEqual(found.map((item) => item.value), [1250, 12.5, -3.25, 0.125, 20]);
});

test('소수와 음수를 허용된 숫자와 대조한다', () => {
  const allowed = buildAllowedNumbers({ shipment: result([{ average: -3.25, qty: 1250 }], [-3.25, 1250]) });
  assert.equal(validateAnswerNumbers(baseAnswer({ answer: '수량은 1,250개, 변동은 -3.25입니다.', evidence: [], recommended_action: null }), allowed).ok, true);
});

test('0부터 1 사이 비율의 백분율 표기를 허용한다', () => {
  const allowed = buildAllowedNumbers({ profile: result([{ rate: 0.125 }], [0.125]) });
  assert.equal(validateAnswerNumbers(baseAnswer({ answer: '비율은 12.5%입니다.', evidence: [], recommended_action: null }), allowed).ok, true);
});

test('품목코드와 기종코드는 숫자 검증에서 제외한다', () => {
  const found = extractAnswerNumbers(baseAnswer({ answer: '602K02693는 MDL121 부품입니다.', evidence: [], recommended_action: null }));
  assert.deepEqual(found, []);
});

test('P80과 연월·날짜는 숫자 검증에서 제외한다', () => {
  const found = extractAnswerNumbers(baseAnswer({ answer: 'P80은 2026-07-01에 산출됐습니다.', evidence: [], recommended_action: null }));
  assert.deepEqual(found, []);
});

test('3M·6M·12M 평균 기간 라벨은 숫자 검증에서 제외한다', () => {
  const answer = baseAnswer({ answer: '3M 평균 779.0, 6M 평균 772.3입니다.', evidence: [], recommended_action: null });
  const allowed = buildAllowedNumbers({ shipment: result([{ average_3m: 779.0, average_6m: 772.3 }], [779.0, 772.3]) });
  assert.deepEqual(extractAnswerNumbers(answer).map((item) => item.value), [779, 772.3]);
  assert.equal(validateAnswerNumbers(answer, allowed).ok, true);
});

test('목록 번호는 숫자 검증에서 제외한다', () => {
  const found = extractAnswerNumbers(baseAnswer({ answer: '1. 첫 번째 항목\n2) 두 번째 항목', evidence: [], recommended_action: null }));
  assert.deepEqual(found, []);
});

test('evidence의 label/value/reason 숫자를 검증 대상에 포함한다', () => {
  const answer = baseAnswer({ answer: '확인했습니다.', evidence: [{ source: 'x', source_type: 'view', source_id: null, claim: 'label 17', value: 'reason 18', data_as_of: null }], recommended_action: '19개를 확인하세요.' });
  const found = extractAnswerNumbers(answer);
  assert.deepEqual(found.map((item) => item.value), [17, 18, 19]);
});

test('null 값은 허용 숫자에 포함하지 않는다', () => {
  const allowed = buildAllowedNumbers({ profile: result([{ value: null }], []) });
  assert.deepEqual(allowed, []);
});

test('ToolResult 숫자를 toolName.key 사전으로 만든다', () => {
  const allowed = buildAllowedNumbers({ shipment: result([{ average_3m: 7, average_6m: 8 }], [7, 8]) });
  assert.deepEqual(allowed.map((item) => item.key), ['shipment.average_3m', 'shipment.average_6m']);
});

test('표기 자릿수 반올림은 허용한다', () => {
  const answer = baseAnswer({ answer: '평균은 12.3입니다.', evidence: [], recommended_action: null });
  const allowed = buildAllowedNumbers({ profile: result([{ average: 12.34 }], [12.34]) });
  assert.equal(validateAnswerNumbers(answer, allowed).ok, true);
});

test('출처 없는 조작 숫자는 거부하고 목록을 반환한다', () => {
  const answer = baseAnswer({ answer: '출고량은 1,251개입니다.', evidence: [], recommended_action: null });
  const allowed = buildAllowedNumbers({ shipment: result([{ qty: 1250 }], [1250]) });
  const validation = validateAnswerNumbers(answer, allowed);
  assert.equal(validation.ok, false);
  assert.deepEqual(validation.unmatched.map((item) => item.value), [1251]);
});

test('answer와 recommended_action의 모든 숫자를 함께 검증한다', () => {
  const answer = baseAnswer({ answer: '수량 10', evidence: [], recommended_action: '20을 발주하세요.' });
  const allowed = buildAllowedNumbers({ plan: result([{ required: 10, order: 20 }], [10, 20]) });
  assert.equal(validateAnswerNumbers(answer, allowed).ok, true);
});

test('허용 숫자가 없으면 숫자가 있는 답변을 거부한다', () => {
  const validation = validateAnswerNumbers(baseAnswer({ answer: '결과는 3입니다.', evidence: [], recommended_action: null }), []);
  assert.equal(validation.ok, false);
});
