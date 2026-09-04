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

export type ShipmentTrend = {
  itemCode: string;
  itemName: string | null;
  period: string | null;
  shipmentCount: number | null;
  shippedQty: number | null;
  averageQty: number | null;
  trend: number | null;
  reasonCode: string | null;
  monthlyQty?: number | null;
  avg3m?: number | null;
  avg6m?: number | null;
  avg12m?: number | null;
  observedMonths?: number | null;
  recentMonth?: string | null;
  recentQty?: number | null;
};

export type DemandProfileRt = {
  itemCode: string;
  itemName: string | null;
  demandType: string | null;
  adi: number | null;
  cvSquared: number | null;
  zeroDemandRate: number | null;
  trend: number | null;
  recentChangeRate: number | null;
  stability: string | null;
  reasonCode: string | null;
  observedMonths?: number | null;
};

export type OlAccuracy = {
  modelBase: string | null;
  fiscalYear: string | null;
  period: string | null;
  nItems: number | null;
  actualQty: number | null;
  forecastQty: number | null;
  wape: number | null;
  mape: number | null;
  bias: number | null;
  rmse: number | null;
  mae: number | null;
  reasonCode: string | null;
  olType?: string | null;
};

export type BomRequirement = {
  modelBase: string | null;
  itemCode: string;
  itemName: string | null;
  componentItemCode: string | null;
  componentItemName: string | null;
  requiredQty: number | null;
  bomQty: number | null;
  linkageStatus: string | null;
  reasonCode: string | null;
  capItemCode?: string | null;
  optionRole?: string | null;
  scc?: string | null;
  label?: string | null;
  common?: boolean | null;
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

export function normalizeShipmentTrend(row: Record<string, unknown>): ShipmentTrend {
  const result: ShipmentTrend = {
    itemCode: String(value(row, ['item_code', 'item_id', 'sku', '품목코드']) ?? '미정'),
    itemName: value(row, ['item_name', '품목명']) === null ? null : String(value(row, ['item_name', '품목명'])),
    period: value(row, ['period', 'month', 'shipment_month', '월']) === null ? null : String(value(row, ['period', 'month', 'shipment_month', '월'])),
    shipmentCount: numberValue(row, ['shipment_count', 'n_shipments', 'shipment_cnt', '출하건수']),
    shippedQty: numberValue(row, ['shipped_qty', 'shipment_qty', 'total_qty', '출하수량']),
    averageQty: numberValue(row, ['average_qty', 'avg_qty', 'mean_qty', '평균출하량']),
    trend: numberValue(row, ['trend', 'trend_per_period', 'slope', '추세']),
    reasonCode: value(row, ['reason_code', 'reason', '사유코드']) === null ? null : String(value(row, ['reason_code', 'reason', '사유코드'])),
  };
  if (Object.keys(row).some((key) => ['monthly_qty', 'avg_3m', 'avg_6m', 'avg_12m', 'observed_months', 'recent_month', 'recent_qty'].includes(key))) {
    result.monthlyQty = numberValue(row, ['monthly_qty', 'shipped_qty', 'shipment_qty', 'total_qty', '출하수량']);
    result.avg3m = numberValue(row, ['avg_3m', 'average_3m', 'rolling_3m']);
    result.avg6m = numberValue(row, ['avg_6m', 'average_6m', 'rolling_6m']);
    result.avg12m = numberValue(row, ['avg_12m', 'average_12m', 'rolling_12m']);
    result.observedMonths = numberValue(row, ['observed_months', 'n_months', '관측개월수']);
    result.recentMonth = value(row, ['recent_month', 'latest_month', '최근월']) === null ? null : String(value(row, ['recent_month', 'latest_month', '최근월']));
    result.recentQty = numberValue(row, ['recent_qty', 'latest_qty', '최근수량']);
  }
  return result;
}

export function normalizeDemandProfileRt(row: Record<string, unknown>): DemandProfileRt {
  const demandType = value(row, ['demand_type', 'demand_class', 'pattern_type', '수요유형']);
  const result: DemandProfileRt = {
    itemCode: String(value(row, ['item_code', 'item_id', 'sku', '품목코드']) ?? '미정'),
    itemName: value(row, ['item_name', '품목명']) === null ? null : String(value(row, ['item_name', '품목명'])),
    demandType: demandType === null ? null : String(demandType).toUpperCase(),
    adi: numberValue(row, ['adi', 'average_demand_interval']),
    cvSquared: numberValue(row, ['cv_squared', 'cv2', 'cv_sq', 'CV2']),
    zeroDemandRate: numberValue(row, ['zero_demand_rate', 'zero_rate', '무수요비율']),
    trend: numberValue(row, ['trend', 'trend_per_period', 'slope', '추세']),
    recentChangeRate: numberValue(row, ['recent_change_rate', 'recent_change', '최근변화율']),
    stability: value(row, ['stability', '안정성']) === null ? null : String(value(row, ['stability', '안정성'])),
    reasonCode: value(row, ['reason_code', 'reason', '사유코드']) === null ? null : String(value(row, ['reason_code', 'reason', '사유코드'])),
  };
  if (Object.keys(row).some((key) => ['observed_months', 'n_months', '관측개월수'].includes(key))) {
    result.observedMonths = numberValue(row, ['observed_months', 'n_months', '관측개월수']);
  }
  return result;
}

export function normalizeOlAccuracy(row: Record<string, unknown>): OlAccuracy {
  const result: OlAccuracy = {
    modelBase: value(row, ['model_base', 'model_id', 'model', '모델']) === null ? null : String(value(row, ['model_base', 'model_id', 'model', '모델'])),
    fiscalYear: value(row, ['fiscal_year', 'fy', '회계연도']) === null ? null : String(value(row, ['fiscal_year', 'fy', '회계연도'])),
    period: value(row, ['period', 'month', '월']) === null ? null : String(value(row, ['period', 'month', '월'])),
    nItems: numberValue(row, ['n_items', 'item_count', '품목수']),
    actualQty: numberValue(row, ['actual_qty', 'actual', 'actual_total', '실적수량']),
    forecastQty: numberValue(row, ['forecast_qty', 'forecast', 'forecast_total', '예측수량']),
    wape: numberValue(row, ['wape', 'WAPE']),
    mape: numberValue(row, ['mape', 'MAPE']),
    bias: numberValue(row, ['bias', 'Bias']),
    rmse: numberValue(row, ['rmse', 'RMSE']),
    mae: numberValue(row, ['mae', 'MAE']),
    reasonCode: value(row, ['reason_code', 'reason', '사유코드']) === null ? null : String(value(row, ['reason_code', 'reason', '사유코드'])),
  };
  if (Object.keys(row).some((key) => ['ol_type', 'forecast_type', '구분'].includes(key))) {
    result.olType = value(row, ['ol_type', 'forecast_type', '구분']) === null ? null : String(value(row, ['ol_type', 'forecast_type', '구분']));
  }
  return result;
}

export function normalizeBomRequirement(row: Record<string, unknown>): BomRequirement {
  const result: BomRequirement = {
    modelBase: value(row, ['model_base', 'model', '기준원']) === null ? null : String(value(row, ['model_base', 'model', '기준원'])),
    itemCode: String(value(row, ['item_code', 'item_id', 'sku', '품목코드']) ?? '미정'),
    itemName: value(row, ['item_name', '품목명']) === null ? null : String(value(row, ['item_name', '품목명'])),
    componentItemCode: value(row, ['component_item_code', 'part_item_code', 'component_id', '구성품코드']) === null ? null : String(value(row, ['component_item_code', 'part_item_code', 'component_id', '구성품코드'])),
    componentItemName: value(row, ['component_item_name', 'part_item_name', '구성품명']) === null ? null : String(value(row, ['component_item_name', 'part_item_name', '구성품명'])),
    requiredQty: numberValue(row, ['required_qty', 'requirement_qty', 'required_quantity', '필요수량']),
    bomQty: numberValue(row, ['bom_qty', 'quantity_per', '구성수량']),
    linkageStatus: value(row, ['linkage_status', 'status', '연결상태']) === null ? null : String(value(row, ['linkage_status', 'status', '연결상태'])),
    reasonCode: value(row, ['reason_code', 'reason', '사유코드']) === null ? null : String(value(row, ['reason_code', 'reason', '사유코드'])),
  };
  if (Object.keys(row).some((key) => ['cap_item_code', 'option_role', 'scc', 'label', 'common'].includes(key))) {
    result.capItemCode = value(row, ['cap_item_code', 'cap_code', 'cap_item_id']) === null ? null : String(value(row, ['cap_item_code', 'cap_code', 'cap_item_id']));
    result.optionRole = value(row, ['option_role', 'role']) === null ? null : String(value(row, ['option_role', 'role']));
    result.scc = value(row, ['scc', 'scc_code']) === null ? null : String(value(row, ['scc', 'scc_code']));
    result.label = value(row, ['label', 'label_code']) === null ? null : String(value(row, ['label', 'label_code']));
    result.common = typeof row.common === 'boolean' ? row.common : value(row, ['common', 'common_flag']) === null ? null : String(value(row, ['common', 'common_flag'])).toUpperCase() === 'COMMON';
  }
  return result;
}
