import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getImportSchema } from '@/lib/import/schema';
import { applyColumnMapping } from '@/lib/import/map';
import { getStagingRows, getUploadBatch, saveMappedValidationResult } from '@/lib/import/repository';
import { validateRows } from '@/lib/import/validate';
import type { ColumnMapping, ImportType, MappedRow } from '@/lib/import/types';

export async function POST(request: Request) {
  await requireUser();
  const body = await request.json().catch(() => null) as { batchId?: string; mapping?: ColumnMapping[] } | null;
  if (!body?.batchId || !Array.isArray(body.mapping)) return NextResponse.json({ error: 'batchId와 mapping이 필요합니다.' }, { status: 422 });
  try {
    const batch = await getUploadBatch(body.batchId);
    const schema = getImportSchema(batch.import_type as ImportType);
    const staging = await getStagingRows(body.batchId);
    const rows: MappedRow[] = staging.map((row) => ({ rowNumber: row.row_number, source: row.raw_data as Record<string, string>, normalized: applyColumnMapping(row.raw_data as Record<string, string>, body.mapping as ColumnMapping[]).normalized }));
    const summary = validateRows(rows, schema);
    await saveMappedValidationResult(body.batchId, batch.import_type as ImportType, rows, summary);
    return NextResponse.json({ ...summary, canImport: summary.errorRows === 0 && summary.rows.length > 0 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '검증에 실패했습니다.' }, { status: 422 });
  }
}
