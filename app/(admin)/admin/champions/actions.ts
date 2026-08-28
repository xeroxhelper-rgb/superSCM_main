'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { setManualChampion } from '@/lib/backtest-admin';

export async function setManualChampionAction(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get('item_id') ?? '');
  const modelId = String(formData.get('model_id') ?? '');
  const reason = String(formData.get('reason') ?? '');
  const backtestRunId = String(formData.get('backtest_run_id') ?? '') || undefined;
  if (!itemId || !modelId || !reason.trim()) redirect('/admin/champions?error=reason');
  try { await setManualChampion({ itemId, modelId, reason, backtestRunId }); redirect('/admin/champions?success=updated'); }
  catch { redirect('/admin/champions?error=update'); }
}
