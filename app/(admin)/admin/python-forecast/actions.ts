'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { runPythonForecast } from '@/lib/python-forecast-admin';

export async function runPythonForecastAction(formData: FormData) {
  await requireAdmin();
  const modelIds = String(formData.get('model_ids') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  const horizonValue = Number(formData.get('horizon') ?? '');
  try { await runPythonForecast({ modelIds, horizon: Number.isFinite(horizonValue) && horizonValue >= 0 ? horizonValue : undefined }); redirect('/admin/python-forecast?success=started'); }
  catch { redirect('/admin/python-forecast?error=service'); }
}
