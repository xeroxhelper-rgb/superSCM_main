import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { buildValidationErrorCsv } from '@/lib/import/history';
import { getBatchErrors } from '@/lib/import/repository';

export async function GET(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  await requireUser();
  try {
    const { batchId } = await context.params;
    const { staging, errors } = await getBatchErrors(batchId);
    const rows = staging.map((row) => ({ rowNumber: row.row_number, source: row.raw_data as Record<string, string>, normalized: (row.mapped_data ?? {}) as Record<string, string> }));
    const csv = buildValidationErrorCsv(rows, errors.map((error) => ({ rowNumber: error.row_number, fieldName: error.field_name ?? '', errorCode: error.error_code, errorMessage: error.error_message, severity: error.severity, originalValue: error.original_value ?? '' })));
    return new Response(`\uFEFF${csv}`, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="validation-errors-${batchId}.csv"` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '오류 CSV를 생성하지 못했습니다.' }, { status: 422 });
  }
}
