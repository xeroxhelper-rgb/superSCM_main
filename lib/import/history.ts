import type { MappedRow, ValidationIssue } from './types';
import type { ImportHistoryRow } from './repository-types';

export function canRollback(row: ImportHistoryRow, isAdmin: boolean): boolean {
  return isAdmin && row.status === 'IMPORTED' && row.importMode !== 'replace';
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildValidationErrorCsv(rows: MappedRow[], issues: ValidationIssue[]): string {
  const errorIssues = issues.filter((issue) => issue.severity === 'ERROR' || issue.severity === 'WARNING');
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row.source))));
  const headers = [...columns, 'row_number', 'error_code', 'error_message', 'severity'];
  const lines = [headers.map(escapeCsv).join(',')];
  for (const issue of errorIssues) {
    const row = rows.find((candidate) => candidate.rowNumber === issue.rowNumber);
    if (!row) continue;
    lines.push([
      ...columns.map((column) => row.source[column] ?? ''),
      issue.rowNumber, issue.errorCode, issue.errorMessage, issue.severity,
    ].map(escapeCsv).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
