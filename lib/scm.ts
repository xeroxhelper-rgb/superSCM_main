import { createSupabaseServerClient } from './supabase';
import { normalizeDemandProfile, normalizeDemandProfileKpi, normalizeForecastModel, normalizeForecastResult, normalizeForecastRun, normalizeLeadtimeGap, normalizeStockoutKpi, normalizeStockoutRisk, type DemandProfile, type DemandProfileKpi, type ForecastModel, type ForecastResult, type ForecastRun, type LeadtimeGap, type StockoutKpi, type StockoutRisk } from './scm-model';

export async function getForecastModels(): Promise<{ rows: ForecastModel[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_model_config').select('*').order('model_id'); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizeForecastModel(row as Record<string, unknown>)), error: null }; }
  catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' }; }
}

export async function getForecastRuns(): Promise<{ rows: ForecastRun[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); const { data, error } = await supabase.schema('analytics').from('v_forecast_run').select('*').order('started_at', { ascending: false }); if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizeForecastRun(row as Record<string, unknown>)), error: null }; }
  catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' }; }
}

export async function getForecastResult(runId?: string): Promise<{ rows: ForecastResult[]; error: string | null }> {
  try { const supabase = await createSupabaseServerClient(); let query = supabase.schema('analytics').from('v_forecast_result').select('*').order('period'); if (runId) query = query.eq('run_id', runId); const { data, error } = await query; if (error) return { rows: [], error: error.message }; return { rows: (data ?? []).map((row) => normalizeForecastResult(row as Record<string, unknown>)), error: null }; }
  catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' }; }
}

export async function getDemandProfile(): Promise<{ rows: DemandProfile[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_sku_demand_profile').select('*');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeDemandProfile(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getDemandProfileKpi(): Promise<{ data: DemandProfileKpi | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_demand_profile_kpi').select('*').maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data ? normalizeDemandProfileKpi(data as Record<string, unknown>) : null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getLeadtimeGap(): Promise<{ rows: LeadtimeGap[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_leadtime_gap').select('*');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeLeadtimeGap(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getStockoutRisk(): Promise<{ rows: StockoutRisk[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_stockout_risk').select('*');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeStockoutRisk(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getStockoutKpi(): Promise<{ data: StockoutKpi | null; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_stockout_kpi').select('*').maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data ? normalizeStockoutKpi(data as Record<string, unknown>) : null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}
