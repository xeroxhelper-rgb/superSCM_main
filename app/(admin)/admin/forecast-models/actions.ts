'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { updateForecastModel } from '@/lib/forecast-admin';

export async function updateForecastModelAction(formData: FormData) {
  await requireAdmin();
  const modelId = String(formData.get('model_id') ?? '');
  const enabled = formData.get('enabled') === 'true';
  let parameters: Record<string, unknown>;
  try { parameters = JSON.parse(String(formData.get('parameters') ?? '{}')) as Record<string, unknown>; } catch { redirect('/admin/forecast-models?error=parameters'); }
  if (!modelId) redirect('/admin/forecast-models?error=invalid');
  try { await updateForecastModel({ modelId, enabled, parameters }); } catch { redirect('/admin/forecast-models?error=update'); }
  redirect('/admin/forecast-models?success=updated');
}
