import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeUploadBatchRow, toStagingInsertRows } from './repository-core.ts';
import type { UploadBatchInput, ImportHistoryRow } from './repository-types.ts';
import type { ImportType } from './types.ts';
import type { MappedRow, ValidationSummary } from './types.ts';
export { normalizeUploadBatchRow, toStagingInsertRows } from './repository-core.ts';
export type { UploadBatchInput, ImportHistoryRow } from './repository-types.ts';

export async function createUploadBatch(input: UploadBatchInput) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  const { data, error } = await supabase.schema('core').from('upload_batch').insert({ ...input, file_name: input.fileName, import_type: input.importType, import_mode: input.importMode, total_rows: input.totalRows, uploaded_by: user.id }).select().single();
  if (error) throw error;
  return data;
}

export async function saveStagingRows(batchId: string, rows: MappedRow[], importType: ImportType): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').from('import_staging').insert(toStagingInsertRows(batchId, rows, importType));
  if (error) throw error;
}

export async function saveValidationResult(batchId: string, summary: ValidationSummary): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (summary.issues.length > 0) {
    const { error } = await supabase.schema('core').from('validation_error').insert(summary.issues.map((issue) => ({ batch_id: batchId, row_number: issue.rowNumber, field_name: issue.fieldName, error_code: issue.errorCode, error_message: issue.errorMessage, severity: issue.severity, original_value: issue.originalValue })));
    if (error) throw error;
  }
  const { error } = await supabase.schema('core').from('upload_batch').update({ success_rows: summary.successRows, warning_rows: summary.warningRows, error_rows: summary.errorRows, status: 'VALIDATED', validation_completed_at: new Date().toISOString() }).eq('batch_id', batchId);
  if (error) throw error;
}

export async function getImportHistory(): Promise<ImportHistoryRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('analytics').from('v_import_history').select('*').order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => normalizeUploadBatchRow(row));
}

export async function importBatch(batchId: string, confirmed: boolean) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').rpc('import_batch', { target_batch_id: batchId, confirmed });
  if (error) throw error;
  return data;
}

export async function rollbackBatch(batchId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').rpc('rollback_batch', { target_batch_id: batchId });
  if (error) throw error;
  return data;
}
