import { NextResponse } from 'next/server';
import { requireAdmin, requireUser } from '@/lib/auth';
import { getSupportedImportTypes } from '@/lib/import/schema';
import { parseImportFile } from '@/lib/import/parse';
import { createUploadBatch, saveStagingRows } from '@/lib/import/repository';
import type { ImportMode, ImportType, MappedRow } from '@/lib/import/types';

const modes: ImportMode[] = ['append', 'upsert', 'replace'];

export async function POST(request: Request) {
  const user = await requireUser();
  const form = await request.formData();
  const file = form.get('file');
  const importType = form.get('importType');
  const importMode = form.get('importMode') ?? 'append';
  if (!(file instanceof File) || typeof importType !== 'string' || !getSupportedImportTypes().includes(importType as ImportType) || typeof importMode !== 'string' || !modes.includes(importMode as ImportMode)) {
    return NextResponse.json({ error: '파일, import type, import mode가 올바르지 않습니다.' }, { status: 422 });
  }
  if (importMode === 'replace') await requireAdmin();
  try {
    const parsed = await parseImportFile(file, importType as ImportType);
    const batch = await createUploadBatch({ fileName: parsed.fileName, importType: importType as ImportType, importMode: importMode as ImportMode, totalRows: parsed.totalRows });
    const rows: MappedRow[] = parsed.rows.map((source, index) => ({ rowNumber: index + 2, source, normalized: {} }));
    await saveStagingRows(batch.batch_id, rows, importType as ImportType);
    return NextResponse.json({ batchId: batch.batch_id, headers: parsed.headers, preview: parsed.rows.slice(0, 20), totalRows: parsed.totalRows, uploadedBy: user.userId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '파일을 처리하지 못했습니다.' }, { status: 422 });
  }
}
