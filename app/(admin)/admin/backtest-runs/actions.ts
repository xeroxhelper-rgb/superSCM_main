'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { runBacktest } from '@/lib/backtest-admin';

export async function runBacktestAction(formData: FormData) {
  await requireAdmin();
  const forecastRunId = String(formData.get('forecast_run_id') ?? '');
  if (!forecastRunId) redirect('/admin/backtest-runs?error=invalid');
  try { await runBacktest({ forecastRunId }); redirect('/admin/backtest-runs?success=started'); }
  catch { redirect('/admin/backtest-runs?error=run'); }
}
