import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgentTool, ToolResult } from './tools.ts';
import type { ChatRequest, ChatResult } from './llm.ts';
import { runAgent } from './orchestrator.ts';

const answerJson = (answer = '조회 결과입니다.') => JSON.stringify({
  answer,
  verdict: 'SUPPORTED',
  evidence: [],
  data_as_of: null,
  risk: 'SAFE',
  recommended_action: null,
  cannot_answer: false,
  cannot_answer_reason: null,
});

function tool(name: string, roles: readonly ('USER' | 'ADMIN')[], run: AgentTool['run']): AgentTool {
  return {
    name,
    description: '테스트 도구',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { itemCode: { type: 'string', minLength: 1 } },
      required: ['itemCode'],
    },
    roles: roles as ['USER', 'ADMIN'],
    run,
  };
}

function success(data: unknown): ToolResult {
  return { ok: true, data, numbers: [], dataAsOf: null, reason: null };
}

test('메시지 순서와 tool_call_id를 유지하며 최종 답변을 반환한다', async () => {
  const requests: ChatRequest[] = [];
  let calls = 0;
  const tools = [tool('allowed', ['USER', 'ADMIN'], async () => { calls += 1; return success([{ value: 7 }]); })];
  const llm = async (request: ChatRequest): Promise<ChatResult> => {
    requests.push(request);
    if (requests.length === 1) {
      return {
        message: { role: 'assistant', content: null },
        toolCalls: [{ id: 'call-1', type: 'function', function: { name: 'allowed', arguments: '{"itemCode":"A"}' } }],
        error: null,
      };
    }
    return { message: { role: 'assistant', content: answerJson('도구 결과를 반영했습니다.') }, toolCalls: [], error: null };
  };

  const result = await runAgent({ question: 'A를 조회해줘', user: { role: 'USER' }, history: [] }, { llm, tools });

  assert.equal(result.answer.answer, '도구 결과를 반영했습니다.');
  assert.equal(calls, 1);
  assert.equal(result.history.at(-2)?.role, 'assistant');
  assert.equal((result.history.at(-2) as { tool_calls?: Array<{ id: string }> }).tool_calls?.[0].id, 'call-1');
  assert.equal(result.history.at(-1)?.role, 'tool');
  assert.equal(result.history.at(-1)?.tool_call_id, 'call-1');
  assert.equal(result.trace[0].name, 'allowed');
  assert.equal(result.trace[0].ok, true);
  assert.equal(requests[1].response_format && (requests[1].response_format as { type: string }).type, 'json_object');
});

test('허용되지 않은 Tool은 실행하지 않고 cannotAnswer로 종료한다', async () => {
  let executed = false;
  const llm = async (): Promise<ChatResult> => ({
    message: { role: 'assistant', content: null },
    toolCalls: [{ id: 'call-admin', type: 'function', function: { name: 'adminOnly', arguments: '{}' } }],
    error: null,
  });
  const result = await runAgent({ question: '관리자 작업', user: { role: 'USER' }, history: [] }, {
    llm,
    tools: [tool('adminOnly', ['ADMIN'], async () => { executed = true; return success([]); })],
  });
  assert.equal(executed, false);
  assert.equal(result.answer.cannot_answer, true);
  assert.match(result.answer.cannot_answer_reason ?? '', /허용되지 않은 Tool/);
  assert.equal(result.trace[0].ok, false);
});

test('잘못된 arguments는 Tool을 실행하지 않고 cannotAnswer로 종료한다', async () => {
  let executed = false;
  const llm = async (): Promise<ChatResult> => ({
    message: { role: 'assistant', content: null },
    toolCalls: [{ id: 'call-bad', type: 'function', function: { name: 'allowed', arguments: '{"unknown":"x"}' } }],
    error: null,
  });
  const result = await runAgent({ question: '잘못된 입력', user: { role: 'USER' }, history: [] }, {
    llm,
    tools: [tool('allowed', ['USER', 'ADMIN'], async () => { executed = true; return success([]); })],
  });
  assert.equal(executed, false);
  assert.equal(result.answer.cannot_answer, true);
  assert.match(result.answer.cannot_answer_reason ?? '', /arguments/);
  assert.equal(result.trace[0].ok, false);
});

test('Tool 실행 직전에 변경된 role을 다시 검사한다', async () => {
  let executed = false;
  const user: { role: 'USER' | 'ADMIN' } = { role: 'USER' };
  const llm = async (request: ChatRequest): Promise<ChatResult> => {
    user.role = 'ADMIN';
    return {
      message: { role: 'assistant', content: null },
      toolCalls: [{ id: 'call-role', type: 'function', function: { name: 'userTool', arguments: '{"itemCode":"A"}' } }],
      error: null,
    };
  };
  const result = await runAgent({ question: '권한 변경', user, history: [] }, {
    llm,
    tools: [tool('userTool', ['USER'] as unknown as ['USER', 'ADMIN'], async () => { executed = true; return success([]); })],
  });
  assert.equal(executed, false);
  assert.equal(result.answer.cannot_answer, true);
});

test('Tool loop는 최대 6회에서 cannotAnswer로 멈춘다', async () => {
  let calls = 0;
  const llm = async (): Promise<ChatResult> => ({
    message: { role: 'assistant', content: null },
    toolCalls: [{ id: `call-${calls}`, type: 'function', function: { name: 'loop', arguments: '{"itemCode":"A"}' } }],
    error: null,
  });
  const result = await runAgent({ question: '계속 실행해줘', user: { role: 'USER' }, history: [] }, {
    llm,
    tools: [tool('loop', ['USER', 'ADMIN'], async () => { calls += 1; return success([]); })],
  });
  assert.equal(calls, 6);
  assert.equal(result.trace.length, 6);
  assert.equal(result.answer.cannot_answer, true);
  assert.match(result.answer.cannot_answer_reason ?? '', /6회/);
});

test('LLM 실패는 예외 대신 cannotAnswer로 반환한다', async () => {
  const result = await runAgent({ question: '실패 테스트', user: { role: 'USER' }, history: [] }, {
    llm: async () => ({ message: null, toolCalls: [], error: 'LLM 오류' }),
    tools: [],
  });
  assert.equal(result.answer.cannot_answer, true);
  assert.match(result.answer.cannot_answer_reason ?? '', /LLM 오류/);
});

test('숫자 불일치 시 출처 없는 숫자를 지적하고 한 번 재생성한다', async () => {
  let llmCalls = 0;
  const llm = async (): Promise<ChatResult> => {
    llmCalls += 1;
    if (llmCalls === 1) return { message: { role: 'assistant', content: null }, toolCalls: [{ id: 'call-number', type: 'function', function: { name: 'allowed', arguments: '{"itemCode":"A"}' } }], error: null };
    const qty = llmCalls === 2 ? 8 : 7;
    return { message: { role: 'assistant', content: answerJson(`수량은 ${qty}개입니다.`) }, toolCalls: [], error: null };
  };
  const result = await runAgent({ question: '수량을 알려줘', user: { role: 'USER' }, history: [] }, {
    llm,
    tools: [tool('allowed', ['USER', 'ADMIN'], async () => success([{ value: 7 }]))],
  });
  assert.equal(llmCalls, 3);
  assert.equal(result.answer.cannot_answer, false);
});

test('숫자 재생성도 불일치하면 답변을 버린다', async () => {
  let llmCalls = 0;
  const llm = async (): Promise<ChatResult> => {
    llmCalls += 1;
    if (llmCalls === 1) return { message: { role: 'assistant', content: null }, toolCalls: [{ id: 'call-number', type: 'function', function: { name: 'allowed', arguments: '{"itemCode":"A"}' } }], error: null };
    return { message: { role: 'assistant', content: answerJson('수량은 8개입니다.') }, toolCalls: [], error: null };
  };
  const result = await runAgent({ question: '수량을 알려줘', user: { role: 'USER' }, history: [] }, {
    llm,
    tools: [tool('allowed', ['USER', 'ADMIN'], async () => success([{ value: 7 }]))],
  });
  assert.equal(llmCalls, 3);
  assert.equal(result.answer.cannot_answer, true);
  assert.match(result.answer.cannot_answer_reason ?? '', /출처 없는 숫자/);
});
