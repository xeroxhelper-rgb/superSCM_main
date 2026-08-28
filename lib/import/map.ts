import type { ColumnMapping, ImportSchema, MappedRow, SourceRow } from './types';

function comparable(value: string): string {
  return value.toLowerCase().replace(/[\s_\-()]/g, '');
}

export function inferColumnMapping(headers: string[], schema: ImportSchema): ColumnMapping[] {
  return headers.map((sourceColumn) => {
    const normalizedSource = comparable(sourceColumn);
    const field = schema.fields.find((candidate) => [candidate.name, candidate.dbColumn, ...candidate.aliases].some((alias) => comparable(alias) === normalizedSource));
    return { sourceColumn, targetColumn: field?.name ?? null, confidence: field ? 1 : 0 };
  });
}

export function applyColumnMapping(row: SourceRow, mapping: ColumnMapping[]): MappedRow {
  const normalized: Record<string, string> = {};
  for (const entry of mapping) {
    if (entry.targetColumn && Object.prototype.hasOwnProperty.call(row, entry.sourceColumn)) {
      normalized[entry.targetColumn] = row[entry.sourceColumn] ?? '';
    }
  }
  return { rowNumber: 0, source: row, normalized };
}
