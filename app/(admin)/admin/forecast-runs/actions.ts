'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { runBaselineForecast } from '@/lib/forecast-admin';

export async function runBaselineForecastAction() {
  await requireAdmin();
  // 실행 경계: core.run_baseline_forecast RPC
  try { const { runId } = await runBaselineForecast(); redirect(`/admin/forecast-runs?run_id=${encodeURIComponent(runId)}&success=started`); }
  catch { redirect('/admin/forecast-runs?error=run'); }
}
