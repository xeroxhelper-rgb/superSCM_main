import { requireAdmin } from './auth.ts';
import { createSupabaseServerClient } from './supabase/server.ts';

export async function updateForecastModel(input: { modelId: string; enabled: boolean; parameters: Record<string, unknown> }) {
  const actor = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema('core').from('model_config').update({ enabled: input.enabled, parameters: input.parameters, updated_by: actor.userId }).eq('model_id', input.modelId);
  if (error) throw new Error('Forecast 모델을 변경하지 못했습니다.');
}

export async function runBaselineForecast() {
  const actor = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').rpc('run_baseline_forecast');
  if (error) throw new Error(error.message);
  return { runId: String(data), actor: actor.userId };
}
