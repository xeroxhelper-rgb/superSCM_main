import { createSupabaseServerClient } from './supabase';
import { normalizePurchaseRecommendation } from './step10-safety-stock-model';
import { normalizeBacktestRun, normalizeChampionModel, normalizeComparisonPoint, normalizeDemandProfile, normalizeDemandProfileKpi, normalizeForecastModel, normalizeForecastResult, normalizeForecastRun, normalizeInventoryProjection, normalizeLeadtimeGap, normalizeLeadtimePolicy, normalizeLeadtimePolicyHistory, normalizeModelPerformance, normalizeStockoutKpi, normalizeStockoutRisk, type BacktestRun, type ChampionModel, type ComparisonPoint, type DemandProfile, type DemandProfileKpi, type ForecastModel, type ForecastResult, type ForecastRun, type InventoryProjection, type LeadtimeGap, type LeadtimePolicy, type LeadtimePolicyHistory, type ModelPerformance, type PurchaseRecommendation, type StockoutKpi, type StockoutRisk } from './scm-model';

async function analyticsRows<T>(view: string, normalize: (row: Record<string, unknown>) => T, apply?: (query: any) => any): Promise<{ rows: T[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase.schema('analytics').from(view).select('*');
    if (apply) query = apply(query);
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row: Record<string, unknown>) => normalize(row)), error: null };
  } catch (error) { return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' }; }
}

export function getBacktestRuns() { return analyticsRows('v_backtest_run', normalizeBacktestRun, (q) => q.order('started_at', { ascending: false })); }
export function getModelPerformance(filters?: { itemId?: string; backtestRunId?: string }) { return analyticsRows('v_model_performance', normalizeModelPerformance, (q) => { let next = q.order('item_id').order('rank'); if (filters?.itemId) next = next.eq('item_id', filters.itemId); if (filters?.backtestRunId) next = next.eq('backtest_run_id', filters.backtestRunId); return next; }); }
export function getChampions() { return analyticsRows('v_champion_model', normalizeChampionModel, (q) => q.order('item_id')); }
export function getModelComparison(filters?: { itemId?: string; runId?: string; modelId?: string; from?: string; to?: string }) { return analyticsRows('v_model_comparison', normalizeComparisonPoint, (q) => { let next = q.order('period'); if (filters?.itemId) next = next.eq('item_id', filters.itemId); if (filters?.runId) next = next.eq('run_id', filters.runId); if (filters?.modelId) next = next.eq('model_id', filters.modelId); if (filters?.from) next = next.gte('period', filters.from); if (filters?.to) next = next.lte('period', filters.to); return next; }); }

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

export function getInventoryProjection(filters?: { itemId?: string; from?: string; to?: string }): Promise<{ rows: InventoryProjection[]; error: string | null }> {
  return analyticsRows('v_inventory_projection', normalizeInventoryProjection, (q) => {
    let next = q.order('item_id').order('period');
    if (filters?.itemId) next = next.eq('item_id', filters.itemId);
    if (filters?.from) next = next.gte('period', filters.from);
    if (filters?.to) next = next.lte('period', filters.to);
    return next;
  });
}

export function getLeadtimePolicy(): Promise<{ rows: LeadtimePolicy[]; error: string | null }> {
  return analyticsRows('v_leadtime_policy', normalizeLeadtimePolicy, (q) => q.order('supplier_id'));
}

export function getLeadtimePolicyHistory(): Promise<{ rows: LeadtimePolicyHistory[]; error: string | null }> {
  return analyticsRows('v_leadtime_policy_history', normalizeLeadtimePolicyHistory, (q) => q.order('changed_at', { ascending: false }));
}

export function getPurchaseRecommendations(filters?: { itemId?: string; riskStatus?: string }): Promise<{ rows: PurchaseRecommendation[]; error: string | null }> {
  return analyticsRows('v_purchase_recommendation', normalizePurchaseRecommendation, (q) => {
    let next = q.order('item_id');
    if (filters?.itemId) next = next.eq('item_id', filters.itemId);
    if (filters?.riskStatus) next = next.eq('risk_status', filters.riskStatus);
    return next;
  });
}

export function getPurchaseRecommendation(itemId: string): Promise<{ rows: PurchaseRecommendation[]; error: string | null }> {
  return getPurchaseRecommendations({ itemId });
}
