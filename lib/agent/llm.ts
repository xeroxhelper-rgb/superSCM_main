export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_call_id?: string;
};

export type LlmToolCall = {
  id: string;
  type: 'function' | string;
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatRequest = {
  messages: ChatMessage[];
  tools?: Record<string, unknown>[];
  tool_choice?: 'auto' | 'none' | 'required' | Record<string, unknown>;
  temperature?: number;
  response_format?: Record<string, unknown>;
};

export type ChatResult = {
  message: ChatMessage | null;
  toolCalls: LlmToolCall[];
  error: string | null;
};

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type LlmEnvironment = {
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

type LlmOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  env?: LlmEnvironment;
};

type HttpResult = {
  status: number;
  body: unknown;
  timedOut: boolean;
};

const fallbackAttempted = new Set<string>();

function errorResult(error: string): ChatResult {
  return { message: null, toolCalls: [], error };
}

function trim(value: string | undefined) {
  const result = value?.trim();
  return result || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(body: unknown, status: number) {
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string') return body.error.message;
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  return `OpenAI 호환 API 요청에 실패했습니다. (HTTP ${status})`;
}

async function requestOnce(fetchImpl: FetchLike, url: string, apiKey: string, payload: Record<string, unknown>, timeoutMs: number): Promise<HttpResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { status: response.status, body: null, timedOut: false };
    }
    return { status: response.status, body, timedOut: false };
  } catch {
    return { status: 0, body: null, timedOut };
  } finally {
    clearTimeout(timeout);
  }
}

function parseCompletion(body: unknown): ChatResult {
  if (!isRecord(body) || !Array.isArray(body.choices) || !isRecord(body.choices[0]) || !isRecord(body.choices[0].message)) {
    return errorResult('OpenAI 호환 API 응답 형식이 올바르지 않습니다.');
  }
  const rawMessage = body.choices[0].message;
  if (typeof rawMessage.role !== 'string' || !(rawMessage.content === null || typeof rawMessage.content === 'string')) {
    return errorResult('OpenAI 호환 API 메시지 형식이 올바르지 않습니다.');
  }
  const toolCalls = Array.isArray(rawMessage.tool_calls) ? rawMessage.tool_calls.filter((call): call is LlmToolCall => isRecord(call) && typeof call.id === 'string' && typeof call.type === 'string' && isRecord(call.function) && typeof call.function.name === 'string' && typeof call.function.arguments === 'string') : [];
  return {
    message: { role: rawMessage.role as ChatMessage['role'], content: rawMessage.content },
    toolCalls,
    error: null,
  };
}

export async function chatCompletion(request: ChatRequest, options: LlmOptions = {}): Promise<ChatResult> {
  const env = options.env ?? process.env;
  const baseUrl = trim(env.OPENAI_BASE_URL);
  const apiKey = trim(env.OPENAI_API_KEY);
  const model = trim(env.OPENAI_MODEL);
  if (!baseUrl || !apiKey || !model) return errorResult('OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL 환경변수를 모두 설정해 주세요.');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) return errorResult('fetch를 사용할 수 없습니다.');
  const timeoutMs = options.timeoutMs ?? 60_000;
  const payload: Record<string, unknown> = { model, messages: request.messages, temperature: request.temperature ?? 0 };
  if (request.tools) payload.tools = request.tools;
  if (request.tool_choice) payload.tool_choice = request.tool_choice;
  if (request.response_format) payload.response_format = request.response_format;
  const key = `${baseUrl}|${model}`;
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let currentPayload = payload;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await requestOnce(fetchImpl, url, apiKey, currentPayload, timeoutMs);
    if (result.timedOut) return errorResult('OpenAI 호환 API 요청 timeout (60초)을 초과했습니다.');
    if (result.status === 0) return errorResult('OpenAI 호환 API 네트워크 요청에 실패했습니다.');
    if (result.status >= 200 && result.status < 300) return parseCompletion(result.body);
    const message = errorMessage(result.body, result.status);
    if (result.status !== 400 || fallbackAttempted.has(key) || attempt > 0) return errorResult(message);
    const responseFormat = currentPayload.response_format;
    if (isRecord(responseFormat) && responseFormat.type === 'json_schema' && /json[_ -]?schema/i.test(message)) {
      fallbackAttempted.add(key);
      currentPayload = { ...currentPayload, response_format: { type: 'json_object' } };
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(currentPayload, 'temperature') && /temperature/i.test(message) && /support|지원/i.test(message)) {
      fallbackAttempted.add(key);
      const { temperature: _temperature, ...withoutTemperature } = currentPayload;
      currentPayload = withoutTemperature;
      continue;
    }
    return errorResult(message);
  }
  return errorResult('OpenAI 호환 API 요청에 실패했습니다.');
}
