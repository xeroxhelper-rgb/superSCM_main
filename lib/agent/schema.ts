export type AgentVerdict = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' | 'CANNOT_ANSWER';
export type AgentRisk = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE';

export type AgentEvidence = {
  source: string;
  source_type: string;
  source_id: string | null;
  claim: string;
  value: string | null;
  data_as_of: string | null;
};

export type AgentAnswer = {
  answer: string;
  verdict: AgentVerdict;
  evidence: AgentEvidence[];
  data_as_of: string | null;
  risk: AgentRisk;
  recommended_action: string | null;
  cannot_answer: boolean;
  cannot_answer_reason: string | null;
};

export const agentAnswerJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    verdict: { type: 'string', enum: ['SUPPORTED', 'PARTIALLY_SUPPORTED', 'UNSUPPORTED', 'CANNOT_ANSWER'] },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source: { type: 'string' },
          source_type: { type: 'string' },
          source_id: { type: ['string', 'null'] },
          claim: { type: 'string' },
          value: { type: ['string', 'null'] },
          data_as_of: { type: ['string', 'null'] },
        },
        required: ['source', 'source_type', 'source_id', 'claim', 'value', 'data_as_of'],
      },
    },
    data_as_of: { type: ['string', 'null'] },
    risk: { type: 'string', enum: ['SAFE', 'WARNING', 'CRITICAL', 'CALCULATION_UNAVAILABLE'] },
    recommended_action: { type: ['string', 'null'] },
    cannot_answer: { type: 'boolean' },
    cannot_answer_reason: { type: ['string', 'null'] },
  },
  required: ['answer', 'verdict', 'evidence', 'data_as_of', 'risk', 'recommended_action', 'cannot_answer', 'cannot_answer_reason'],
} as const;

export const agentAnswerStructuredOutput = {
  type: 'json_schema',
  json_schema: {
    name: 'agent_answer',
    strict: true,
    schema: agentAnswerJsonSchema,
  },
} as const;

const answerKeys = ['answer', 'verdict', 'evidence', 'data_as_of', 'risk', 'recommended_action', 'cannot_answer', 'cannot_answer_reason'];
const evidenceKeys = ['source', 'source_type', 'source_id', 'claim', 'value', 'data_as_of'];
const verdicts = new Set<AgentVerdict>(['SUPPORTED', 'PARTIALLY_SUPPORTED', 'UNSUPPORTED', 'CANNOT_ANSWER']);
const risks = new Set<AgentRisk>(['SAFE', 'WARNING', 'CRITICAL', 'CALCULATION_UNAVAILABLE']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actualKeys = Object.keys(value).sort();
  return actualKeys.length === keys.length && actualKeys.every((key, index) => key === [...keys].sort()[index]);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseEvidence(value: unknown): AgentEvidence | null {
  if (!isRecord(value) || !hasExactKeys(value, evidenceKeys)) return null;
  if (typeof value.source !== 'string' || typeof value.source_type !== 'string' || !nullableString(value.source_id)) return null;
  if (typeof value.claim !== 'string' || !nullableString(value.value) || !nullableString(value.data_as_of)) return null;
  return value as AgentEvidence;
}

export function parseAgentAnswer(input: string): AgentAnswer | null {
  try {
    const value: unknown = JSON.parse(input);
    if (!isRecord(value) || !hasExactKeys(value, answerKeys)) return null;
    if (typeof value.answer !== 'string' || typeof value.verdict !== 'string' || !verdicts.has(value.verdict as AgentVerdict)) return null;
    if (!Array.isArray(value.evidence)) return null;
    const evidence = value.evidence.map(parseEvidence);
    if (evidence.some((item) => item === null)) return null;
    if (!nullableString(value.data_as_of) || typeof value.risk !== 'string' || !risks.has(value.risk as AgentRisk)) return null;
    if (!nullableString(value.recommended_action) || typeof value.cannot_answer !== 'boolean' || !nullableString(value.cannot_answer_reason)) return null;
    if (value.cannot_answer !== (value.verdict === 'CANNOT_ANSWER')) return null;
    if (value.cannot_answer && (!value.cannot_answer_reason || value.risk !== 'CALCULATION_UNAVAILABLE')) return null;
    if (!value.cannot_answer && value.cannot_answer_reason !== null) return null;
    return { ...value, evidence } as AgentAnswer;
  } catch {
    return null;
  }
}

export function cannotAnswer(reason: string): AgentAnswer {
  return {
    answer: '현재 답변에 필요한 데이터가 없습니다.',
    verdict: 'CANNOT_ANSWER',
    evidence: [],
    data_as_of: null,
    risk: 'CALCULATION_UNAVAILABLE',
    recommended_action: null,
    cannot_answer: true,
    cannot_answer_reason: reason,
  };
}
