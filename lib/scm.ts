import { createSupabaseServerClient } from './supabase';
import { normalizeBomRequirement, normalizeDemandProfileRt, normalizeItemDemandKpi, normalizeItemDemandProfile, normalizeLeadtimeGap, normalizeOlAccuracy, normalizeOlAccuracyFy, normalizeShipmentTrend, normalizeStockoutKpi, normalizeStockoutRisk, type BomRequirement, type DemandProfileRt, type ItemDemandKpi, type ItemDemandProfile, type LeadtimeGap, type OlAccuracy, type OlAccuracyFy, type ShipmentTrend, type StockoutKpi, type StockoutRisk } from './scm-model';

type QueryResult<T> = { rows: T[]; error: string | null };

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

export async function getShipmentTrend(itemCode: string): Promise<{ rows: ShipmentTrend[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const query = supabase.schema('analytics').from('v_shipment_by_hoc').select('*').eq('item_code', itemCode);
    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeShipmentTrend(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getDemandProfile(itemCode: string): Promise<{ rows: DemandProfileRt[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('fact').from('fact_shipment').select('*').eq('item_code', itemCode);
    if (error) return { rows: [], error: error.message };
    const facts = (data ?? []) as Record<string, unknown>[];
    if (facts.length === 0) return { rows: [], error: null };
    const monthValues = facts.map((row) => String(row.period ?? row.shipment_month ?? row.ship_date ?? row.shipped_at ?? '')).filter(Boolean).map((value) => value.slice(0, 7));
    const observedMonths = Array.from(new Set(monthValues)).sort();
    const monthKeys = (start: string, end: string) => {
      const result: string[] = [];
      const cursor = new Date(`${start}-01T00:00:00Z`);
      const limit = new Date(`${end}-01T00:00:00Z`);
      while (cursor <= limit) {
        result.push(cursor.toISOString().slice(0, 7));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      return result;
    };
    const months = observedMonths.length > 1 ? monthKeys(observedMonths[0], observedMonths[observedMonths.length - 1]) : observedMonths;
    const monthlyQuantities = new Map<string, number>();
    facts.forEach((row, index) => {
      const quantity = Number(row.quantity ?? row.shipped_qty ?? row.qty);
      if (Number.isFinite(quantity)) {
        const month = monthValues[index] ?? `row-${index}`;
        monthlyQuantities.set(month, (monthlyQuantities.get(month) ?? 0) + quantity);
      }
    });
    const quantities = months.map((month) => monthlyQuantities.get(month) ?? 0);
    const nonZero = quantities.filter((quantity) => quantity > 0);
    const mean = nonZero.length ? nonZero.reduce((sum, quantity) => sum + quantity, 0) / nonZero.length : null;
    const sd = mean !== null && nonZero.length > 1 ? Math.sqrt(nonZero.reduce((sum, quantity) => sum + (quantity - mean) ** 2, 0) / (nonZero.length - 1)) : null;
    const adi = nonZero.length ? months.length / nonZero.length : null;
    const cvSquared = mean && sd !== null ? (sd / mean) ** 2 : null;
    const reasonCode = months.length < 6 ? 'INSUFFICIENT_HISTORY' : nonZero.length === 0 ? 'NO_DEMAND' : adi === null || cvSquared === null ? 'INSUFFICIENT_HISTORY' : null;
    const demandType = reasonCode || adi === null || cvSquared === null ? null : adi < 1.32 && cvSquared < 0.49 ? 'SMOOTH' : adi >= 1.32 && cvSquared < 0.49 ? 'INTERMITTENT' : adi < 1.32 ? 'ERRATIC' : 'LUMPY';
    return { rows: [normalizeDemandProfileRt({ item_code: itemCode, item_name: facts[0].item_name ?? null, observed_months: months.length, adi, cv_squared: cvSquared, zero_demand_rate: months.length ? (months.length - nonZero.length) / months.length : null, demand_type: demandType, reason_code: reasonCode })], error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getOlAccuracy(modelBase: string, fy?: string | null): Promise<{ rows: OlAccuracy[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const query = supabase.schema('fact').from('fact_mc_plan_actual').select('*').eq('model_base', modelBase);
    const filteredQuery = fy === undefined || fy === null ? query : query.eq('fy', fy);
    const { data, error } = await filteredQuery;
    if (error) return { rows: [], error: error.message };
    const rows = (data ?? []) as Record<string, unknown>[];
    const scored = rows.filter((row) => row.act !== null && row.act !== undefined && Number.isFinite(Number(row.act)));
    const build = (olType: string, keys: string[]) => {
      const typeRows = scored.filter((row) => keys.some((key) => row[key] !== null && row[key] !== undefined && Number.isFinite(Number(row[key]))));
      const denominator = typeRows.reduce((sum, row) => sum + Number(row.act), 0);
      const numerator = typeRows.reduce((sum, row) => {
        const forecast = Number(keys.map((key) => row[key]).find((value) => value !== null && value !== undefined));
        return sum + Math.abs(forecast - Number(row.act));
      }, 0);
      const bias = typeRows.reduce((sum, row) => {
        const forecast = Number(keys.map((key) => row[key]).find((value) => value !== null && value !== undefined));
        return sum + forecast - Number(row.act);
      }, 0);
      return normalizeOlAccuracy({ model_base: modelBase, fiscal_year: fy, ol_type: olType, n_items: typeRows.length, wape: denominator === 0 ? null : numerator / denominator, bias: denominator === 0 ? null : bias / denominator, reason_code: typeRows.length === 0 ? 'NO_OL_DATA' : denominator === 0 ? 'ZERO_ACTUAL_DENOMINATOR' : null });
    };
    return {
      rows: [build('SALES_OL', ['sales_ol', 'sales_ol_qty']), build('SCM_OL', ['scm_ol', 'scm_ol_qty'])],
      error: null,
    };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

export async function getBomRequirement(modelBase: string): Promise<{ rows: BomRequirement[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const [mcCap, capOption, bom, optionModel, sccConfig] = await Promise.all([
      supabase.schema('bridge').from('bridge_mc_cap').select('*'),
      supabase.schema('bridge').from('bridge_cap_option').select('*'),
      supabase.schema('bridge').from('bridge_bom').select('*'),
      supabase.schema('bridge').from('bridge_option_model').select('*'),
      supabase.schema('bridge').from('bridge_scc_config').select('*'),
    ]);
    const failed = [mcCap, capOption, bom, optionModel, sccConfig].find((result) => result.error);
    if (failed?.error) return { rows: [], error: failed.error.message };
    const caps = ((mcCap.data ?? []) as Record<string, unknown>[]).filter((row) => String(row.model_base ?? '') === modelBase);
    const capCodes = new Set(caps.map((row) => String(row.cap_item_code ?? row.cap_code ?? row.item_code ?? '')));
    const options = ((capOption.data ?? []) as Record<string, unknown>[]).filter((row) => capCodes.has(String(row.cap_item_code ?? row.cap_code ?? '')));
    const optionCodes = new Set(options.map((row) => String(row.option_item_code ?? row.option_code ?? row.item_code ?? '')));
    const commonCodes = new Set(((optionModel.data ?? []) as Record<string, unknown>[]).filter((row) => String(row.model_base ?? '') === modelBase && String(row.common ?? row.common_flag ?? '').toUpperCase() === 'COMMON').map((row) => String(row.option_item_code ?? row.option_code ?? row.item_code ?? '')));
    const resultRows = ((bom.data ?? []) as Record<string, unknown>[]).filter((row) => optionCodes.has(String(row.parent_item_code ?? row.option_item_code ?? row.parent_code ?? ''))).map((row) => normalizeBomRequirement({ ...row, model_base: modelBase, cap_item_code: row.cap_item_code ?? row.parent_item_code, option_role: options.find((option) => String(option.option_item_code ?? option.option_code ?? option.item_code) === String(row.parent_item_code ?? row.option_item_code ?? row.parent_code))?.role ?? null, common: commonCodes.has(String(row.parent_item_code ?? row.option_item_code ?? row.parent_code)) }));
    return { rows: resultRows, error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'Supabase 조회에 실패했습니다.' };
  }
}

/** 실데이터 수요 프로파일 — analytics.v_item_demand_profile */
export async function getItemDemandProfiles(): Promise<QueryResult<ItemDemandProfile>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_item_demand_profile').select('*').order('item_code');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeItemDemandProfile(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : '수요 프로파일을 조회하지 못했습니다.' };
  }
}

/** 실데이터 수요 유형 KPI — analytics.v_item_demand_kpi */
export async function getItemDemandKpi(): Promise<QueryResult<ItemDemandKpi>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_item_demand_kpi').select('*').order('item_type');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeItemDemandKpi(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : '수요 KPI를 조회하지 못했습니다.' };
  }
}

/** 실데이터 출고 추이 — XCN 합산이 반영된 analytics.v_shipment_trend */
export async function getShipmentTrends(): Promise<QueryResult<ShipmentTrend>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_shipment_trend').select('*').order('total_qty', { ascending: false, nullsFirst: false });
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeShipmentTrend(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : '출고 추이를 조회하지 못했습니다.' };
  }
}

/** 회계연도 합산 OL 정확도 — analytics.v_ol_accuracy_fy */
export async function getOlAccuracyFy(): Promise<QueryResult<OlAccuracyFy>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.schema('analytics').from('v_ol_accuracy_fy').select('*').order('fy_sheet');
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((row) => normalizeOlAccuracyFy(row as Record<string, unknown>)), error: null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : 'OL 정확도 요약을 조회하지 못했습니다.' };
  }
}

/** 기준 프로젝트 명칭과의 호환 alias */
export const getBomRequirements = getBomRequirement;
