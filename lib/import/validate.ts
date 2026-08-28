import type { ImportSchema, MappedRow, ValidationContext, ValidationIssue, ValidationSeverity, ValidationStatus, ValidationSummary } from './types';

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidNumber(value: string): boolean {
  return value.trim() !== '' && /^[-+]?\d+(?:\.\d+)?$/.test(value.trim());
}

function addIssue(issues: ValidationIssue[], row: MappedRow, fieldName: string, errorCode: string, errorMessage: string, severity: ValidationSeverity, originalValue = ''): void {
  issues.push({ rowNumber: row.rowNumber, fieldName, errorCode, errorMessage, severity, originalValue });
}

function keyFor(row: MappedRow, fields: string[]): string {
  return fields.map((field) => row.normalized[field] ?? '').join('\u001f');
}

export function validateRows(rows: MappedRow[], schema: ImportSchema, context: ValidationContext = {}): ValidationSummary {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();
  for (const row of rows) {
    for (const field of schema.fields.filter((candidate) => candidate.required)) {
      const value = row.normalized[field.name];
      if (isBlank(value)) addIssue(issues, row, field.name, 'REQUIRED_VALUE_MISSING', `${field.name} 필수값이 없습니다.`, 'ERROR', value ?? '');
    }
    for (const field of schema.fields) {
      const value = row.normalized[field.name];
      if (isBlank(value)) continue;
      if (field.kind === 'number' && !isValidNumber(value)) addIssue(issues, row, field.name, 'INVALID_NUMBER', `${field.name}이 숫자 형식이 아닙니다.`, 'ERROR', value);
      if (field.kind === 'date' && !isValidDate(value)) addIssue(issues, row, field.name, 'INVALID_DATE', `${field.name}이 유효한 날짜 형식이 아닙니다.`, 'ERROR', value);
      if (field.kind === 'number' && !field.allowNegative && Number(value) < 0) addIssue(issues, row, field.name, 'NEGATIVE_QUANTITY', `${field.name}에 음수를 사용할 수 없습니다.`, 'ERROR', value);
    }
    if (row.normalized.item_id && context.knownItems && !context.knownItems.has(row.normalized.item_id)) addIssue(issues, row, 'item_id', 'UNKNOWN_ITEM', '등록되지 않은 품목코드입니다.', 'ERROR', row.normalized.item_id);
    if (row.normalized.supplier_id && context.knownSuppliers && !context.knownSuppliers.has(row.normalized.supplier_id)) addIssue(issues, row, 'supplier_id', 'UNKNOWN_SUPPLIER', '등록되지 않은 공급처입니다.', 'ERROR', row.normalized.supplier_id);
    const key = keyFor(row, schema.businessKey);
    if (schema.businessKey.length > 0 && key && seen.has(key)) addIssue(issues, row, schema.businessKey.join(','), 'DUPLICATE_SOURCE_ROW', '파일 안에 동일한 business key가 있습니다.', context.duplicateSeverity ?? 'ERROR', key);
    if (schema.businessKey.length > 0 && key) seen.set(key, row.rowNumber);
    if (context.existingKeys?.has(key)) addIssue(issues, row, schema.businessKey.join(','), 'DUPLICATE_EXISTING_ROW', '기존 데이터와 business key가 겹칩니다.', context.duplicateSeverity ?? 'ERROR', key);
    if (row.normalized.order_date && row.normalized.receipt_date && row.normalized.order_date > row.normalized.receipt_date) addIssue(issues, row, 'receipt_date', 'DATE_ORDER_INVALID', '입고일이 발주일보다 빠릅니다.', 'ERROR', row.normalized.receipt_date);
  }
  const rowStatuses = rows.map((row) => {
    const rowIssues = issues.filter((issue) => issue.rowNumber === row.rowNumber);
    const status: ValidationStatus = rowIssues.some((issue) => issue.severity === 'ERROR') ? 'ERROR' : rowIssues.length > 0 ? 'WARNING' : 'SUCCESS';
    return { rowNumber: row.rowNumber, status };
  });
  return {
    rows: rowStatuses,
    issues,
    successRows: rowStatuses.filter((row) => row.status === 'SUCCESS').length,
    warningRows: rowStatuses.filter((row) => row.status === 'WARNING').length,
    errorRows: rowStatuses.filter((row) => row.status === 'ERROR').length,
  };
}
