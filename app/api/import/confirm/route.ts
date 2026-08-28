import { NextResponse } from 'next/server';
import { requireAdmin, requireUser } from '@/lib/auth';
import { getUploadBatch, importBatch } from '@/lib/import/repository';

export async function POST(request: Request) {
  await requireUser();
  const body = await request.json().catch(() => null) as { batchId?: string; confirmed?: boolean } | null;
  if (!body?.batchId || body.confirmed !== true) return NextResponse.json({ error: '사용자 확인이 필요합니다.' }, { status: 422 });
  try {
    const batch = await getUploadBatch(body.batchId);
    if (batch.import_mode === 'replace') await requireAdmin();
    return NextResponse.json(await importBatch(body.batchId, true));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '적재에 실패했습니다.' }, { status: 409 });
  }
}
