export type LeadtimeGap = {
  supplier: string;
  country: string;
  masterLeadTime: number | null;
  sampleCount: number;
  actualAverage: number | null;
  p80: number | null;
  gap: number | null;
};

export type RiskStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE';

export type StockoutRisk = {
  itemId: string;
  itemName: string;
  supplier: string;
  currentStock: number | null;
  inboundQty: number | null;
  availableQty: number | null;
  dailyUsageAvg: number | null;
  plannedLeadTime: number | null;
  stockoutDays: number | null;
  stockoutDate: string | null;
  riskStatus: RiskStatus;
  reason: string | null;
};

export type StockoutKpi = {
  nItems: number | null;
  nCritical: number | null;
  nSafe: number | null;
  nUnknown: number | null;
  nWithin30d: number | null;
  avgStockoutDays: number | null;
};

export type DemandType = 'SMOOTH' | 'INTERMITTENT' | 'ERRATIC' | 'LUMPY';

export type DemandProfile = {
  itemId: string;
  itemName: string;
  nPeriods: number | null;
  nNonzeroPeriods: number | null;
  adi: number | null;
  cv: number | null;
  cvSquared: number | null;
  zeroDemandRate: number | null;
  trend: number | null;
  recentChangeRate: number | null;
  peakPeriod: string | null;
  demandType: DemandType | null;
  seasonality: boolean | null;
  reasonCode: string | null;
  stability: 'STABLE' | 'VARIABLE' | null;
};

export type DemandProfileKpi = {
  totalItems: number | null;
  nSmooth: number | null;
  nIntermittent: number | null;
  nErratic: number | null;
  nLumpy: number | null;
  nCrostonNeeded: number | null;
  nCalculationUnavailable: number | null;
};

function value(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return null;
}

function numberValue(row: Record<string, unknown>, keys: string[]) {
  const raw = value(row, keys);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function demandTypeValue(row: Record<string, unknown>): DemandType | null {
  const raw = value(row, ['demand_type', 'demandType']);
  return raw === 'SMOOTH' || raw === 'INTERMITTENT' || raw === 'ERRATIC' || raw === 'LUMPY' ? raw : null;
}

function booleanValue(row: Record<string, unknown>, keys: string[]) {
  const raw = value(row, keys);
  return typeof raw === 'boolean' ? raw : raw === null ? null : raw === 'true' ? true : raw === 'false' ? false : null;
}

export function normalizeDemandProfile(row: Record<string, unknown>): DemandProfile {
  const peak = value(row, ['peak_period', 'peakPeriod']);
  const stability = value(row, ['stability']);
  return {
    itemId: String(value(row, ['item_id', 'item_code', 'SKU']) ?? '미정'),
    itemName: String(value(row, ['item_name', '품목명']) ?? '미정'),
    nPeriods: numberValue(row, ['n_periods']),
    nNonzeroPeriods: numberValue(row, ['n_nonzero_periods']),
    adi: numberValue(row, ['adi']),
    cv: numberValue(row, ['cv']),
    cvSquared: numberValue(row, ['cv_squared', 'cv2']),
    zeroDemandRate: numberValue(row, ['zero_demand_rate']),
    trend: numberValue(row, ['trend', 'trend_per_period']),
    recentChangeRate: numberValue(row, ['recent_change_rate']),
    peakPeriod: peak === null ? null : String(peak),
    demandType: demandTypeValue(row),
    seasonality: booleanValue(row, ['seasonality']),
    reasonCode: value(row, ['reason_code', 'reasonCode']) === null ? null : String(value(row, ['reason_code', 'reasonCode'])),
    stability: stability === 'STABLE' || stability === 'VARIABLE' ? stability : null,
  };
}

export function normalizeDemandProfileKpi(row: Record<string, unknown>): DemandProfileKpi {
  return {
    totalItems: numberValue(row, ['total_items']),
    nSmooth: numberValue(row, ['n_smooth']),
    nIntermittent: numberValue(row, ['n_intermittent']),
    nErratic: numberValue(row, ['n_erratic']),
    nLumpy: numberValue(row, ['n_lumpy']),
    nCrostonNeeded: numberValue(row, ['n_croston_needed']),
    nCalculationUnavailable: numberValue(row, ['n_calculation_unavailable']),
  };
}

export function normalizeLeadtimeGap(row: Record<string, unknown>): LeadtimeGap {
  return {
    supplier: String(value(row, ['supplier_name', 'supplier', '법인', '공급처', '공급업체명']) ?? '미정'),
    country: String(value(row, ['country', '국가']) ?? '미정'),
    masterLeadTime: numberValue(row, ['std_lead_time', 'master_lt', 'master_lead_time', 'planned_lead_time', '표준리드타임', '표준리드타임(일)', '마스터값']),
    sampleCount: numberValue(row, ['n_samples', 'sample_count', 'samples', '표본수']) ?? 0,
    actualAverage: numberValue(row, ['mean_days', 'actual_avg', 'actual_average', 'avg_lead_time', '실적평균']),
    p80: numberValue(row, ['p80_days', 'p80', 'P80']),
    gap: numberValue(row, ['gap_days', 'gap', 'leadtime_gap', '격차']),
  };
}

export function normalizeStockoutRisk(row: Record<string, unknown>): StockoutRisk {
  const rawStatus = String(value(row, ['risk_status', 'status', '위험상태']) ?? 'UNKNOWN').toUpperCase();
  const reason = value(row, ['reason', 'reason_code', '사유코드']);
  const riskStatus: RiskStatus = rawStatus === 'SAFE'
    ? 'SAFE'
    : rawStatus === 'CRITICAL'
      ? 'CRITICAL'
      : rawStatus === 'WARNING'
        ? 'WARNING'
        : 'CALCULATION_UNAVAILABLE';
  return {
    itemId: String(value(row, ['item_id', 'item_code', '품목코드']) ?? '미정'),
    itemName: String(value(row, ['item_name', '품목명']) ?? '미정'),
    supplier: String(value(row, ['supplier_name', 'supplier_id', 'supplier', '생산법인']) ?? '미정'),
    currentStock: numberValue(row, ['current_stock', 'stock_on_hand', '현재고']),
    inboundQty: numberValue(row, ['inbound_qty', 'inbound', '입고예정']),
    availableQty: numberValue(row, ['available_qty', '가용재고']),
    dailyUsageAvg: numberValue(row, ['daily_usage_avg', 'usage_avg', '일평균사용량']),
    plannedLeadTime: numberValue(row, ['planned_lead_time', 'lead_time', '계획리드타임']),
    stockoutDays: numberValue(row, ['stockout_days', '소진일수']),
    stockoutDate: value(row, ['stockout_date', '소진예상일']) === null ? null : String(value(row, ['stockout_date', '소진예상일'])),
    riskStatus,
    reason: reason === null ? null : String(reason),
  };
}

export function normalizeStockoutKpi(row: Record<string, unknown>): StockoutKpi {
  return {
    nItems: numberValue(row, ['n_items', 'item_count']),
    nCritical: numberValue(row, ['n_critical', 'critical_count']),
    nSafe: numberValue(row, ['n_safe', 'safe_count']),
    nUnknown: numberValue(row, ['n_unknown', 'unknown_count']),
    nWithin30d: numberValue(row, ['n_within_30d', 'within_30d']),
    avgStockoutDays: numberValue(row, ['avg_stockout_days', 'average_stockout_days']),
  };
}
