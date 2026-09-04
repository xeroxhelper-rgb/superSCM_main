export type ToolResult = {
  ok: boolean;
  data: unknown;
  numbers: number[];
  dataAsOf: string | null;
  reason: string | null;
};

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  roles: readonly ['USER', 'ADMIN'];
  run: (input: unknown) => Promise<ToolResult>;
};

const itemParameters = {
  type: 'object',
  additionalProperties: false,
  properties: { itemCode: { type: 'string', minLength: 1 } },
  required: ['itemCode'],
};

const accuracyParameters = {
  type: 'object',
  additionalProperties: false,
  properties: {
    modelBase: { type: 'string', minLength: 1 },
    fy: { type: ['string', 'null'] },
  },
  required: ['modelBase', 'fy'],
};

const modelParameters = {
  type: 'object',
  additionalProperties: false,
  properties: { modelBase: { type: 'string', minLength: 1 } },
  required: ['modelBase'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectNumbers(value: unknown, output: number[]) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    output.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, output);
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) collectNumbers(item, output);
  }
}

function firstField(value: unknown, keys: string[]): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstField(item, keys);
      if (result !== null) return result;
    }
  } else if (isRecord(value)) {
    for (const key of keys) {
      if (typeof value[key] === 'string' && value[key]) return value[key];
    }
    for (const item of Object.values(value)) {
      const result = firstField(item, keys);
      if (result !== null) return result;
    }
  }
  return null;
}

export function makeToolResult(data: unknown[], dataAsOf: string | null = null, reason: string | null = null): ToolResult {
  const numbers: number[] = [];
  collectNumbers(data, numbers);
  const resolvedReason = reason ?? firstField(data, ['reason_code', 'reason']);
  return {
    ok: data.length > 0,
    data,
    numbers,
    dataAsOf: dataAsOf ?? firstField(data, ['data_as_of', 'dataAsOf', 'loaded_at', 'period']),
    reason: resolvedReason,
  };
}

function invalidParameters(): ToolResult {
  return makeToolResult([], null, 'INVALID_PARAMETERS');
}

function asString(input: unknown, key: string): string | null {
  return isRecord(input) && typeof input[key] === 'string' && input[key].trim() ? input[key].trim() : null;
}

export const agentTools: AgentTool[] = [
  {
    name: 'getShipmentTrend',
    description: '품목의 월별 출고량과 3개월·6개월·12개월 평균 추세를 조회합니다.',
    parameters: itemParameters,
    roles: ['USER', 'ADMIN'],
    async run(input) {
      const itemCode = asString(input, 'itemCode');
      if (!itemCode) return invalidParameters();
      try {
        const { getShipmentTrend } = await import('../scm.ts');
        const result = await getShipmentTrend(itemCode);
        return makeToolResult(result.rows, null, result.error);
      } catch (error) {
        return makeToolResult([], null, error instanceof Error ? error.message : '조회에 실패했습니다.');
      }
    },
  },
  {
    name: 'getDemandProfile',
    description: '품목의 실출하 기반 수요 프로파일과 수요 유형을 조회합니다.',
    parameters: itemParameters,
    roles: ['USER', 'ADMIN'],
    async run(input) {
      const itemCode = asString(input, 'itemCode');
      if (!itemCode) return invalidParameters();
      try {
        const { getDemandProfile } = await import('../scm.ts');
        const result = await getDemandProfile(itemCode);
        return makeToolResult(result.rows, null, result.error);
      } catch (error) {
        return makeToolResult([], null, error instanceof Error ? error.message : '조회에 실패했습니다.');
      }
    },
  },
  {
    name: 'getOlAccuracy',
    description: '기종 기준과 회계연도별 Sales OL·SCM OL 정확도를 조회합니다.',
    parameters: accuracyParameters,
    roles: ['USER', 'ADMIN'],
    async run(input) {
      const modelBase = asString(input, 'modelBase');
      const fy = isRecord(input) && (input.fy === null || typeof input.fy === 'string') ? input.fy : undefined;
      if (!modelBase || fy === undefined) return invalidParameters();
      try {
        const { getOlAccuracy } = await import('../scm.ts');
        const result = await getOlAccuracy(modelBase, fy);
        return makeToolResult(result.rows, null, result.error);
      } catch (error) {
        return makeToolResult([], null, error instanceof Error ? error.message : '조회에 실패했습니다.');
      }
    },
  },
  {
    name: 'getBomRequirement',
    description: '기종의 CAP·필수 옵션·SCC/Label·구성 품목과 수량을 조회합니다.',
    parameters: modelParameters,
    roles: ['USER', 'ADMIN'],
    async run(input) {
      const modelBase = asString(input, 'modelBase');
      if (!modelBase) return invalidParameters();
      try {
        const { getBomRequirement } = await import('../scm.ts');
        const result = await getBomRequirement(modelBase);
        return makeToolResult(result.rows, null, result.error);
      } catch (error) {
        return makeToolResult([], null, error instanceof Error ? error.message : '조회에 실패했습니다.');
      }
    },
  },
];
