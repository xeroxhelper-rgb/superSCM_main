import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { rollbackBatch } from '@/lib/import/repository';

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null) as { batchId?: string } | null;
  if (!body?.batchId) return NextResponse.json({ error: 'batchId가 필요합니다.' }, { status: 422 });
  try {
    return NextResponse.json(await rollbackBatch(body.batchId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'rollback에 실패했습니다.' }, { status: 409 });
  }
}
