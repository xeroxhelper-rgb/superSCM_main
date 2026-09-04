import test from 'node:test';
import assert from 'node:assert/strict';
import { chatCompletion, type FetchLike } from './llm.ts';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function config(suffix: string) {
  return {
    OPENAI_BASE_URL: `https://llm-${suffix}.example.test/`,
    OPENAI_API_KEY: ' test-key ',
    OPENAI_MODEL: `test-model-${suffix}`,
  };
}

test('필수 LLM 환경변수가 없으면 fetch 없이 error를 반환한다', async () => {
  const original = { ...process.env };
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  let called = false;
  const result = await chatCompletion({ messages: [{ role: 'user', content: '안녕' }] }, { fetchImpl: (async () => { called = true; return response({}); }) as FetchLike });
  process.env = original;
  assert.equal(called, false);
  assert.match(result.error ?? '', /OPENAI_BASE_URL/);
});

test('tool_calls를 파싱하고 지원 요청을 trim된 인증 헤더로 전송한다', async () => {
  const original = { ...process.env };
  Object.assign(process.env, config('tools'));
  let received: { body: string; headers: Headers } = { body: '', headers: new Headers() };
  const result = await chatCompletion({
    messages: [{ role: 'user', content: '품목을 찾아줘' }],
    tools: [{ type: 'function', function: { name: 'get_item', parameters: { type: 'object' } } }],
    tool_choice: 'auto',
    temperature: 0,
    response_format: { type: 'json_schema' },
  }, { fetchImpl: (async (_input, init) => {
    received = { body: String(init?.body), headers: new Headers(init?.headers) };
    return response({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_item', arguments: '{"itemCode":"ITEM001"}' } }] } }] });
  }) as FetchLike });
  process.env = original;
  assert.equal(result.error, null);
  assert.deepEqual(result.toolCalls, [{ id: 'call_1', type: 'function', function: { name: 'get_item', arguments: '{"itemCode":"ITEM001"}' } }]);
  assert.equal(received.headers.get('authorization'), 'Bearer test-key');
  assert.equal((JSON.parse(received.body) as { tool_choice: string }).tool_choice, 'auto');
});

test('json_schema 400은 같은 모델에서 json_object로 한 번만 재시도한다', async () => {
  const original = { ...process.env };
  Object.assign(process.env, config('schema-fallback'));
  const bodies: Record<string, unknown>[] = [];
  let calls = 0;
  const result = await chatCompletion({ messages: [{ role: 'user', content: '답해' }], response_format: { type: 'json_schema', json_schema: {} } }, { fetchImpl: (async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    calls += 1;
    return calls === 1 ? response({ error: { message: 'json_schema is not supported' } }, 400) : response({ choices: [{ message: { role: 'assistant', content: '{}' } }] });
  }) as FetchLike });
  process.env = original;
  assert.equal(result.error, null);
  assert.equal(calls, 2);
  assert.equal((bodies[1].response_format as { type: string }).type, 'json_object');
});

test('temperature 미지원 400은 temperature를 빼고 한 번만 재시도한다', async () => {
  const original = { ...process.env };
  Object.assign(process.env, config('temperature-fallback'));
  const bodies: Record<string, unknown>[] = [];
  let calls = 0;
  const result = await chatCompletion({ messages: [{ role: 'user', content: '답해' }], temperature: 0 }, { fetchImpl: (async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    calls += 1;
    return calls === 1 ? response({ error: { message: "'temperature' does not support 0 with this model" } }, 400) : response({ choices: [{ message: { role: 'assistant', content: '완료' } }] });
  }) as FetchLike });
  process.env = original;
  assert.equal(result.error, null);
  assert.equal(calls, 2);
  assert.equal('temperature' in bodies[1], false);
});

test('60초 timeout은 주입 fetch가 지연되면 error를 반환한다', async () => {
  const original = { ...process.env };
  Object.assign(process.env, config('timeout'));
  const result = await chatCompletion({ messages: [{ role: 'user', content: '대기' }] }, { timeoutMs: 5, fetchImpl: (async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  })) as FetchLike });
  process.env = original;
  assert.match(result.error ?? '', /timeout/i);
});
