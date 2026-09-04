'use server';

import { requireUser } from '@/lib/auth';
import { runAgent } from '@/lib/agent/orchestrator';
import { makeAgentErrorState, makeAgentSuccessState, validateAgentQuestion, type AgentUiState } from './state';

function hasOpenAiConfiguration() {
  return Boolean(process.env.OPENAI_BASE_URL?.trim() && process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim());
}

export async function askAgent(_previousState: AgentUiState, formData: FormData): Promise<AgentUiState> {
  const user = await requireUser();
  const configured = hasOpenAiConfiguration();
  if (!configured) return makeAgentErrorState('OpenAI 환경변수를 확인해 주세요.', false);
  const question = String(formData.get('question') ?? '');
  const questionError = validateAgentQuestion(question);
  if (questionError) return makeAgentErrorState(questionError, true);
  try {
    const result = await runAgent({ question, user: { role: user.role }, history: [] });
    return makeAgentSuccessState(result.answer, result.trace, true);
  } catch {
    return makeAgentErrorState('Agent 실행 중 오류가 발생했습니다.', true);
  }
}
