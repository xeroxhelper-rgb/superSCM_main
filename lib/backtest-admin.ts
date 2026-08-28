import { requireAdmin } from './auth';
import { createSupabaseServerClient } from './supabase/server';

export async function runBacktest(input: { forecastRunId: string; metric?: string }) {
  const actor = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').rpc('run_backtest', { p_forecast_run_id: input.forecastRunId, p_metric: input.metric ?? null });
  if (error) throw new Error(error.message);
  return { backtestRunId: String(data), actor: actor.userId };
}

export async function setManualChampion(input: { itemId: string; modelId: string; reason: string; backtestRunId?: string }) {
  const actor = await requireAdmin();
  if (!input.reason.trim()) throw new Error('수동 Champion 변경 사유는 필수입니다.');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema('core').rpc('set_manual_champion', { p_item_id: input.itemId, p_model_id: input.modelId, p_reason: input.reason.trim(), p_backtest_run_id: input.backtestRunId ?? null });
  if (error) throw new Error(error.message);
  return { championId: String(data), actor: actor.userId };
}
