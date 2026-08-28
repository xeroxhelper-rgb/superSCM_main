import { getImportSchema } from './schema.ts';
import type { ImportHistoryRow, ImportType, MappedRow } from './repository-types';

export function toStagingInsertRows(batchId: string, rows: MappedRow[], importType?: ImportType) {
  const fields = importType ? getImportSchema(importType).fields : [];
  return rows.map((row) => ({
    batch_id: batchId,
    row_number: row.rowNumber,
    raw_data: row.source,
    mapped_data: fields.length === 0
      ? row.normalized
      : Object.fromEntries(fields.map((field) => [field.dbColumn, row.normalized[field.name] ?? '']).filter(([, value]) => value !== '')),
  }));
}

export function normalizeUploadBatchRow(row: Record<string, unknown>): ImportHistoryRow {
  return {
    batchId: String(row.batch_id ?? ''), fileName: String(row.file_name ?? ''),
    importType: row.import_type as ImportType, importMode: row.import_mode as ImportHistoryRow['importMode'],
    totalRows: Number(row.total_rows ?? 0), successRows: Number(row.success_rows ?? 0),
    warningRows: Number(row.warning_rows ?? 0), errorRows: Number(row.error_rows ?? 0),
    status: String(row.status ?? ''), uploader: String(row.uploaded_by_email ?? '알 수 없음'),
    uploadedAt: String(row.uploaded_at ?? ''),
  };
}
