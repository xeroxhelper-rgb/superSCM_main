import type { AgentAnswer } from './schema.ts';
import type { ToolResult } from './tools.ts';

export type ExtractedAnswerNumber = {
  value: number;
  raw: string;
  path: string;
  percent: boolean;
};

export type AllowedNumber = {
  key: string;
  value: number;
};

export type GuardrailResult = {
  ok: boolean;
  numbers: ExtractedAnswerNumber[];
  unmatched: ExtractedAnswerNumber[];
};

const excluded = /\b\d{3}[A-Z]\d{5}\b|\bMDL[A-Z0-9-]+\b|\bP\d+\b|\b\d+M\b|\b\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?\b/gi;
const listNumber = /^\s*\d+[.)](?=\s)/gm;
const numberToken = /(?<![A-Za-z0-9_])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:%)?/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringsToCheck(answer: AgentAnswer): Array<{ path: string; value: string }> {
  const values: Array<{ path: string; value: string }> = [];
  if (typeof answer.answer === 'string') values.push({ path: 'answer', value: answer.answer });
  answer.evidence.forEach((evidence, index) => {
    const candidate = evidence as unknown as Record<string, unknown>;
    for (const key of ['claim', 'label', 'value', 'reason']) {
      if (typeof candidate[key] === 'string') values.push({ path: `evidence.${index}.${key}`, value: candidate[key] });
    }
  });
  if (typeof answer.recommended_action === 'string') values.push({ path: 'recommended_action', value: answer.recommended_action });
  return values;
}

function extractFromText(text: string, path: string): ExtractedAnswerNumber[] {
  const masked = text.replace(excluded, (match) => ' '.repeat(match.length)).replace(listNumber, (match) => ' '.repeat(match.length));
  const numbers: ExtractedAnswerNumber[] = [];
  for (const match of Array.from(masked.matchAll(numberToken))) {
    const raw = match[0];
    const percent = raw.endsWith('%');
    const value = Number(raw.replace(/,/g, '').replace(/%$/, ''));
    if (Number.isFinite(value)) numbers.push({ value, raw, path, percent });
  }
  return numbers;
}

export function extractAnswerNumbers(answer: AgentAnswer): ExtractedAnswerNumber[] {
  return stringsToCheck(answer).flatMap(({ path, value }) => extractFromText(value, path));
}

function collectDataNumbers(value: unknown, path: string, output: AllowedNumber[]) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    output.push({ key: path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectDataNumbers(item, `${path}.${index}`, output));
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => collectDataNumbers(item, `${path}.${key}`, output));
  }
}

export function buildAllowedNumbers(results: Record<string, ToolResult | ToolResult[]>): AllowedNumber[] {
  const output: AllowedNumber[] = [];
  for (const [toolName, rawResults] of Object.entries(results)) {
    const list = Array.isArray(rawResults) ? rawResults : [rawResults];
    list.forEach((result, resultIndex) => {
      const before = output.length;
      if (Array.isArray(result.data)) result.data.forEach((item) => collectDataNumbers(item, toolName, output));
      else collectDataNumbers(result.data, toolName, output);
      result.numbers.forEach((value, index) => {
        if (Number.isFinite(value) && !output.some((item) => item.value === value && item.key.startsWith(`${toolName}.`))) {
          output.push({ key: `${toolName}.value_${resultIndex}_${index}`, value });
        }
      });
      if (output.length === before && result.numbers.length === 0) return;
    });
  }
  return output;
}

function matches(extracted: ExtractedAnswerNumber, allowed: AllowedNumber): boolean {
  const target = extracted.percent && allowed.value >= 0 && allowed.value <= 1 ? extracted.value / 100 : extracted.value;
  if (target === allowed.value) return true;
  const decimals = (extracted.raw.replace(/%$/, '').split('.')[1] ?? '').length;
  if (decimals > 3) return false;
  const unit = 10 ** -decimals;
  return Math.abs(target - allowed.value) < unit / 2 + Number.EPSILON;
}

export function validateAnswerNumbers(answer: AgentAnswer, allowed: AllowedNumber[]): GuardrailResult {
  const numbers = extractAnswerNumbers(answer);
  const unmatched = numbers.filter((number) => !allowed.some((candidate) => matches(number, candidate)));
  return { ok: unmatched.length === 0, numbers, unmatched };
}
