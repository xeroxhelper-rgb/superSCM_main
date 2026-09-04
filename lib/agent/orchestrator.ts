import { cannotAnswer, parseAgentAnswer, type AgentAnswer } from './schema.ts';
import type { ChatMessage, ChatRequest, ChatResult } from './llm.ts';
import type { AgentTool, ToolResult } from './tools.ts';
import { buildAllowedNumbers, validateAnswerNumbers } from './guardrail.ts';

export type AgentRole = 'USER' | 'ADMIN';

export type AgentUser = {
  role: AgentRole;
};

export type AgentTrace = {
  name: string;
  args: unknown;
  ok: boolean;
  ms: number;
  reason: string | null;
};

export type RunAgentInput = {
  question: string;
  user: AgentUser;
  history: ChatMessage[];
};

export type AgentLlm = (request: ChatRequest) => Promise<ChatResult>;

export type RunAgentOptions = {
  llm?: AgentLlm;
  tools?: AgentTool[];
  timeoutMs?: number;
  maxRounds?: number;
};

export type RunAgentResult = {
  answer: AgentAnswer;
  history: ChatMessage[];
  trace: AgentTrace[];
};

type ToolCallMessage = ChatMessage & {
  tool_calls: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function matchesType(value: unknown, type: unknown): boolean {
  if (Array.isArray(type)) return type.some((item) => matchesType(value, item));
  if (type === 'string') return typeof value === 'string';
  if (type === 'null') return value === null;
  if (type === 'object') return isRecord(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  return true;
}

function validArguments(value: unknown, schema: Record<string, unknown>): boolean {
  if (!matchesType(value, schema.type)) return false;
  if (!isRecord(value)) return true;
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (required.some((key) => typeof key !== 'string' || !(key in value))) return false;
  if (schema.additionalProperties === false && Object.keys(value).some((key) => !(key in properties))) return false;
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!(key in value) || !isRecord(propertySchema)) continue;
    if (!matchesType(value[key], propertySchema.type)) return false;
    if (typeof value[key] === 'string' && typeof propertySchema.minLength === 'number' && value[key].length < propertySchema.minLength) return false;
  }
  return true;
}

function openAiTool(tool: AgentTool): Record<string, unknown> {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  };
}

function assistantMessage(message: ChatMessage | null, toolCalls: ToolCallMessage['tool_calls']): ToolCallMessage {
  return {
    role: 'assistant',
    content: message?.content ?? null,
    tool_calls: toolCalls,
  };
}

function resultWithReason(answer: AgentAnswer, history: ChatMessage[], trace: AgentTrace[]): RunAgentResult {
  return { answer, history, trace };
}

function recordRejectedCall(trace: AgentTrace[], name: string, args: unknown, reason: string) {
  trace.push({ name, args, ok: false, ms: 0, reason });
}

async function defaultLlm(request: ChatRequest): Promise<ChatResult> {
  const { chatCompletion } = await import('./llm.ts');
  return chatCompletion(request);
}

async function withinDeadline<T>(operation: Promise<T>, remainingMs: number): Promise<T | null> {
  if (remainingMs <= 0) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), remainingMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runAgent(input: RunAgentInput, options: RunAgentOptions = {}): Promise<RunAgentResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? 60_000;
  const maxRounds = options.maxRounds ?? 6;
  const llm = options.llm ?? defaultLlm;
  const tools = options.tools ?? [];
  const allowedTools = tools.filter((tool) => tool.roles.includes(input.user.role));
  const toolsByName = new Map(allowedTools.map((tool) => [tool.name, tool]));
  const messages: ChatMessage[] = [...input.history, { role: 'user', content: input.question }];
  const trace: AgentTrace[] = [];
  const toolResults: Record<string, ToolResult[]> = {};
  let loweredResponseFormat = false;
  let regenerationUsed = false;

  for (let round = 0; round < maxRounds; round += 1) {
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    const schemaModule = await import('./schema.ts');
    const request: ChatRequest = {
      messages: [...messages],
      tools: allowedTools.map(openAiTool),
      tool_choice: 'auto',
      temperature: 0,
      response_format: loweredResponseFormat ? { type: 'json_object' } : schemaModule.agentAnswerStructuredOutput,
    };
    let llmResult: ChatResult | null;
    try {
      llmResult = await withinDeadline(Promise.resolve().then(() => llm(request)), remainingMs);
    } catch (error) {
      return resultWithReason(cannotAnswer(error instanceof Error ? error.message : 'LLM 호출에 실패했습니다.'), messages, trace);
    }
    if (!llmResult) return resultWithReason(cannotAnswer('전체 Agent 실행 시간이 초과되었습니다.'), messages, trace);
    if (llmResult.error) return resultWithReason(cannotAnswer(llmResult.error), messages, trace);

    if (llmResult.toolCalls.length === 0) {
      const answer = parseAgentAnswer(llmResult.message?.content ?? '');
      if (!answer) return resultWithReason(cannotAnswer('LLM 답변 형식이 올바르지 않습니다.'), messages, trace);
      const validation = validateAnswerNumbers(answer, buildAllowedNumbers(toolResults));
      if (validation.ok) return resultWithReason(answer, messages, trace);
      if (regenerationUsed) {
        return resultWithReason(cannotAnswer(`출처 없는 숫자가 포함되어 답변을 폐기했습니다: ${validation.unmatched.map((item) => item.raw).join(', ')}`), messages, trace);
      }
      regenerationUsed = true;
      messages.push({
        role: 'system',
        content: `다음 숫자는 Tool 결과에서 출처를 확인할 수 없습니다: ${validation.unmatched.map((item) => item.raw).join(', ')}. 출처 없는 숫자를 제거하거나 Tool 결과에 있는 값만 사용해 동일한 형식으로 한 번만 다시 답변하세요.`,
      });
      let regenerated: ChatResult | null;
      try {
        const remainingMs = timeoutMs - (Date.now() - startedAt);
        regenerated = await withinDeadline(Promise.resolve().then(() => llm({
          ...request,
          messages: [...messages],
          response_format: { type: 'json_object' },
        })), remainingMs);
      } catch {
        regenerated = null;
      }
      const regeneratedAnswer = regenerated && !regenerated.error && regenerated.toolCalls.length === 0
        ? parseAgentAnswer(regenerated.message?.content ?? '')
        : null;
      if (!regeneratedAnswer) return resultWithReason(cannotAnswer('숫자 검증 재생성에 실패해 답변을 폐기했습니다.'), messages, trace);
      const secondValidation = validateAnswerNumbers(regeneratedAnswer, buildAllowedNumbers(toolResults));
      return secondValidation.ok
        ? resultWithReason(regeneratedAnswer, messages, trace)
        : resultWithReason(cannotAnswer(`출처 없는 숫자가 재생성 답변에도 포함되어 답변을 폐기했습니다: ${secondValidation.unmatched.map((item) => item.raw).join(', ')}`), messages, trace);
    }

    const calls = llmResult.toolCalls.map((call) => ({ id: call.id, type: call.type, function: call.function }));
    messages.push(assistantMessage(llmResult.message, calls));
    loweredResponseFormat = true;

    for (const call of llmResult.toolCalls) {
      const tool = toolsByName.get(call.function.name);
      let args: unknown;
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        const reason = `Tool arguments JSON을 해석할 수 없습니다: ${call.function.name}`;
        recordRejectedCall(trace, call.function.name, call.function.arguments, reason);
        return resultWithReason(cannotAnswer(reason), messages, trace);
      }
      if (!tool) {
        const reason = `허용되지 않은 Tool입니다: ${call.function.name}`;
        recordRejectedCall(trace, call.function.name, args, reason);
        return resultWithReason(cannotAnswer(reason), messages, trace);
      }
      if (!tool.roles.includes(input.user.role)) {
        const reason = `실행 직전 권한이 변경되어 Tool을 실행할 수 없습니다: ${call.function.name}`;
        recordRejectedCall(trace, call.function.name, args, reason);
        return resultWithReason(cannotAnswer(reason), messages, trace);
      }
      if (!isRecord(tool.parameters) || !validArguments(args, tool.parameters)) {
        const reason = `잘못된 arguments입니다: ${call.function.name}`;
        recordRejectedCall(trace, call.function.name, args, reason);
        return resultWithReason(cannotAnswer(reason), messages, trace);
      }

      const toolStartedAt = Date.now();
      let toolResult: ToolResult | null = null;
      let toolError: string | null = null;
      try {
        const remainingForTool = timeoutMs - (Date.now() - startedAt);
        toolResult = await withinDeadline(Promise.resolve().then(() => tool.run(args)), remainingForTool);
        if (!toolResult) toolError = 'Tool 실행 시간이 초과되었습니다.';
      } catch (error) {
        toolError = error instanceof Error ? error.message : 'Tool 실행에 실패했습니다.';
      }
      const ok = Boolean(toolResult?.ok) && !toolError;
      const reason = toolError ?? toolResult?.reason ?? null;
      trace.push({ name: call.function.name, args, ok, ms: Date.now() - toolStartedAt, reason });
      if (!ok || !toolResult) return resultWithReason(cannotAnswer(reason ?? `Tool 실행에 실패했습니다: ${call.function.name}`), messages, trace);
      toolResults[call.function.name] = [...(toolResults[call.function.name] ?? []), toolResult];
      messages.push({ role: 'tool', content: JSON.stringify(toolResult), tool_call_id: call.id });
    }
  }

  return resultWithReason(cannotAnswer(`Tool loop가 최대 ${maxRounds}회에 도달했습니다.`), messages, trace);
}
