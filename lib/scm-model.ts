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

export type ForecastModel = {
  modelId: string;
  modelName: string;
  family: string;
  engine: string;
  version: string;
  enabled: boolean;
  isDefault: boolean;
  applicableDemandType: string[];
  parameters: Record<string, unknown>;
  description: string | null;
};

export type ForecastRun = {
  runId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  granularity: string;
  trainStart: string | null;
  trainEnd: string | null;
  horizon: number | null;
  dataSnapshotAt: string | null;
  nModels: number | null;
  nItems: number | null;
  nRows: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  triggeredEmail: string | null;
  message: string | null;
  isStale: boolean | null;
  staleReason: string | null;
};

export type ForecastResult = {
  runId: string;
  modelId: string;
  modelName: string;
  itemId: string;
  period: string;
  modelVersion: string;
  predictedQty: number | null;
  p50: number | null;
  p80: number | null;
  p90: number | null;
  sigma: number | null;
  basis: string | null;
  reasonCode: string | null;
};

export type BacktestRun = {
  backtestRunId: string;
  forecastRunId: string;
  testStart: string | null;
  testEnd: string | null;
  metric: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string | null;
  finishedAt: string | null;
  triggeredBy: string | null;
  message: string | null;
};

export type ModelPerformance = {
  performanceId: string;
  backtestRunId: string;
  runId: string;
  modelId: string;
  modelVersion: string | null;
  itemId: string;
  nPeriods: number | null;
  nComparedPeriods: number | null;
  wape: number | null;
  mape: number | null;
  bias: number | null;
  rmse: number | null;
  mae: number | null;
  baselineImprovement: number | null;
  rank: number | null;
  metricValue: number | null;
  calculationStatus: string;
  reasonCode: string | null;
};

export type ChampionModel = {
  championId: string;
  itemId: string;
  backtestRunId: string | null;
  forecastRunId: string | null;
  championModelId: string;
  modelVersion: string | null;
  championMetric: string;
  championMetricValue: number | null;
  wape: number | null;
  mape: number | null;
  bias: number | null;
  rmse: number | null;
  mae: number | null;
  candidatePerformance: Record<string, unknown>[];
  selectionReason: string | null;
  selectionMethod: 'AUTO' | 'MANUAL';
  selectedAt: string | null;
};

export type ComparisonPoint = {
  runId: string;
  backtestRunId: string | null;
  modelId: string;
  modelName: string;
  itemId: string;
  period: string;
  modelVersion: string | null;
  predictedQty: number | null;
  p50: number | null;
  p80: number | null;
  p90: number | null;
  actualQty: number | null;
  wape: number | null;
  mape: number | null;
  bias: number | null;
  rmse: number | null;
  mae: number | null;
  rank: number | null;
  calculationStatus: string | null;
  reasonCode: string | null;
  isChampion: boolean;
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

function jsonValue(row: Record<string, unknown>, keys: string[]) {
  const raw = value(row, keys);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

function stringArrayValue(row: Record<string, unknown>, keys: string[]) {
  const raw = value(row, keys);
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function normalizeForecastModel(row: Record<string, unknown>): ForecastModel {
  return {
    modelId: String(value(row, ['model_id']) ?? '미정'), modelName: String(value(row, ['model_name']) ?? '미정'),
    family: String(value(row, ['family']) ?? '미정'), engine: String(value(row, ['engine']) ?? '미정'), version: String(value(row, ['version']) ?? '미정'),
    enabled: booleanValue(row, ['enabled']) ?? false, isDefault: booleanValue(row, ['is_default']) ?? false,
    applicableDemandType: stringArrayValue(row, ['applicable_demand_type']), parameters: jsonValue(row, ['parameters']),
    description: value(row, ['description']) === null ? null : String(value(row, ['description'])),
  };
}

export function normalizeForecastRun(row: Record<string, unknown>): ForecastRun {
  const status = value(row, ['status']);
  return {
    runId: String(value(row, ['run_id']) ?? '미정'), status: status === 'RUNNING' || status === 'SUCCESS' || status === 'FAILED' ? status : 'FAILED',
    granularity: String(value(row, ['granularity']) ?? '미정'), trainStart: value(row, ['train_start']) as string | null,
    trainEnd: value(row, ['train_end']) as string | null, horizon: numberValue(row, ['horizon']), dataSnapshotAt: value(row, ['data_snapshot_at']) as string | null,
    nModels: numberValue(row, ['n_models']), nItems: numberValue(row, ['n_items']), nRows: numberValue(row, ['n_rows']),
    startedAt: value(row, ['started_at']) as string | null, finishedAt: value(row, ['finished_at']) as string | null, durationMs: numberValue(row, ['duration_ms']),
    triggeredEmail: value(row, ['triggered_email']) as string | null, message: value(row, ['message']) as string | null,
    isStale: booleanValue(row, ['is_stale']), staleReason: value(row, ['stale_reason']) as string | null,
  };
}

export function normalizeForecastResult(row: Record<string, unknown>): ForecastResult {
  return {
    runId: String(value(row, ['run_id']) ?? '미정'), modelId: String(value(row, ['model_id']) ?? '미정'), modelName: String(value(row, ['model_name']) ?? '미정'),
    itemId: String(value(row, ['item_id']) ?? '미정'), period: String(value(row, ['period']) ?? '미정'), modelVersion: String(value(row, ['model_version']) ?? '미정'),
    predictedQty: numberValue(row, ['predicted_qty']), p50: numberValue(row, ['p50']), p80: numberValue(row, ['p80']), p90: numberValue(row, ['p90']), sigma: numberValue(row, ['sigma']),
    basis: value(row, ['basis']) as string | null, reasonCode: value(row, ['reason_code']) as string | null,
  };
}

export function normalizeBacktestRun(row: Record<string, unknown>): BacktestRun {
  const status = value(row, ['status']);
  return { backtestRunId: String(value(row, ['backtest_run_id']) ?? '미정'), forecastRunId: String(value(row, ['forecast_run_id']) ?? '미정'), testStart: value(row, ['test_start']) as string | null, testEnd: value(row, ['test_end']) as string | null, metric: String(value(row, ['metric']) ?? '미정'), status: status === 'RUNNING' || status === 'SUCCESS' || status === 'FAILED' ? status : 'FAILED', startedAt: value(row, ['started_at']) as string | null, finishedAt: value(row, ['finished_at']) as string | null, triggeredBy: value(row, ['triggered_by']) as string | null, message: value(row, ['message']) as string | null };
}

export function normalizeModelPerformance(row: Record<string, unknown>): ModelPerformance {
  return { performanceId: String(value(row, ['performance_id']) ?? '미정'), backtestRunId: String(value(row, ['backtest_run_id']) ?? '미정'), runId: String(value(row, ['run_id']) ?? '미정'), modelId: String(value(row, ['model_id']) ?? '미정'), modelVersion: value(row, ['model_version']) as string | null, itemId: String(value(row, ['item_id']) ?? '미정'), nPeriods: numberValue(row, ['n_periods']), nComparedPeriods: numberValue(row, ['n_compared_periods']), wape: numberValue(row, ['wape']), mape: numberValue(row, ['mape']), bias: numberValue(row, ['bias']), rmse: numberValue(row, ['rmse']), mae: numberValue(row, ['mae']), baselineImprovement: numberValue(row, ['baseline_improvement']), rank: numberValue(row, ['rank']), metricValue: numberValue(row, ['metric_value']), calculationStatus: String(value(row, ['calculation_status']) ?? 'UNAVAILABLE'), reasonCode: value(row, ['reason_code']) as string | null };
}

export function normalizeChampionModel(row: Record<string, unknown>): ChampionModel {
  const method = value(row, ['selection_method']);
  const candidates = value(row, ['candidate_performance']);
  return { championId: String(value(row, ['champion_id']) ?? '미정'), itemId: String(value(row, ['item_id']) ?? '미정'), backtestRunId: value(row, ['backtest_run_id']) as string | null, forecastRunId: value(row, ['forecast_run_id']) as string | null, championModelId: String(value(row, ['champion_model_id']) ?? '미정'), modelVersion: value(row, ['model_version']) as string | null, championMetric: String(value(row, ['champion_metric']) ?? '미정'), championMetricValue: numberValue(row, ['champion_metric_value']), wape: numberValue(row, ['wape']), mape: numberValue(row, ['mape']), bias: numberValue(row, ['bias']), rmse: numberValue(row, ['rmse']), mae: numberValue(row, ['mae']), candidatePerformance: Array.isArray(candidates) ? candidates as Record<string, unknown>[] : [], selectionReason: value(row, ['selection_reason']) as string | null, selectionMethod: method === 'MANUAL' ? 'MANUAL' : 'AUTO', selectedAt: value(row, ['selected_at']) as string | null };
}

export function normalizeComparisonPoint(row: Record<string, unknown>): ComparisonPoint {
  return { runId: String(value(row, ['run_id']) ?? '미정'), backtestRunId: value(row, ['backtest_run_id']) as string | null, modelId: String(value(row, ['model_id']) ?? '미정'), modelName: String(value(row, ['model_name']) ?? value(row, ['model_id']) ?? '미정'), itemId: String(value(row, ['item_id']) ?? '미정'), period: String(value(row, ['period']) ?? '미정'), modelVersion: value(row, ['model_version']) as string | null, predictedQty: numberValue(row, ['predicted_qty']), p50: numberValue(row, ['p50']), p80: numberValue(row, ['p80']), p90: numberValue(row, ['p90']), actualQty: numberValue(row, ['actual_qty']), wape: numberValue(row, ['wape']), mape: numberValue(row, ['mape']), bias: numberValue(row, ['bias']), rmse: numberValue(row, ['rmse']), mae: numberValue(row, ['mae']), rank: numberValue(row, ['rank']), calculationStatus: value(row, ['calculation_status']) as string | null, reasonCode: value(row, ['reason_code']) as string | null, isChampion: booleanValue(row, ['is_champion']) ?? false };
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
