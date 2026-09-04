import test from 'node:test';
import assert from 'node:assert/strict';
import { cannotAnswer, parseAgentAnswer } from './schema.ts';

const validAnswer = {
  answer: '재고 위험을 확인할 수 있습니다.',
  verdict: 'SUPPORTED',
  evidence: [{
    source: 'analytics.v_stockout_risk',
    source_type: 'VIEW',
    source_id: 'ITEM001',
    claim: '재고 위험 상태는 SAFE입니다.',
    value: 'SAFE',
    data_as_of: '2026-09-04',
  }],
  data_as_of: '2026-09-04',
  risk: 'SAFE',
  recommended_action: null,
  cannot_answer: false,
  cannot_answer_reason: null,
};

test('유효한 AgentAnswer JSON을 파싱한다', () => {
  assert.deepEqual(parseAgentAnswer(JSON.stringify(validAnswer)), validAnswer);
});

test('잘못된 JSON은 null을 반환한다', () => {
  assert.equal(parseAgentAnswer('{"answer":'), null);
});

test('필수 필드가 빠진 JSON은 null을 반환한다', () => {
  const { risk: _risk, ...missingField } = validAnswer;
  assert.equal(parseAgentAnswer(JSON.stringify(missingField)), null);
});

test('계산 불가 응답은 표준 필드와 reason을 모두 포함한다', () => {
  assert.deepEqual(cannotAnswer('NO_FORECAST'), {
    answer: '현재 답변에 필요한 데이터가 없습니다.',
    verdict: 'CANNOT_ANSWER',
    evidence: [],
    data_as_of: null,
    risk: 'CALCULATION_UNAVAILABLE',
    recommended_action: null,
    cannot_answer: true,
    cannot_answer_reason: 'NO_FORECAST',
  });
});
