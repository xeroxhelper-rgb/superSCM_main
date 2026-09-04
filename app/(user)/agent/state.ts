import type { AgentAnswer } from '@/lib/agent/schema';
import type { AgentTrace } from '@/lib/agent/orchestrator';

export type AgentUiState = {
  status: 'idle' | 'success' | 'error';
  answer: AgentAnswer | null;
  trace: AgentTrace[];
  error: string | null;
  configured: boolean;
};

export const initialAgentState: AgentUiState = {
  status: 'idle',
  answer: null,
  trace: [],
  error: null,
  configured: false,
};

export function validateAgentQuestion(question: string): string | null {
  return question.trim() ? null : '질문을 입력해 주세요.';
}

export function makeAgentErrorState(error: string, configured = true): AgentUiState {
  return { status: 'error', answer: null, trace: [], error, configured };
}

export function makeAgentSuccessState(answer: AgentAnswer, trace: AgentTrace[], configured = true): AgentUiState {
  return { status: 'success', answer, trace, error: null, configured };
}
