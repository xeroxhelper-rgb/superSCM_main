export type SafetyStockCalculationStatus = 'CALCULATED' | 'CALCULATED_NO_ORDER' | 'CALCULATION_UNAVAILABLE';

export type SafetyStockInput = {
  forecastQty: number | null;
  confirmedOrderQty: number | null;
  leadTime: number | null;
  demandPerPeriod: number | null;
  demandSigma: number | null;
  leadTimeSigma: number | null;
  zValue: number | null;
  availableInventory: number | null;
  scheduledReceipt: number | null;
  moq: number | null;
  packSize: number | null;
};

export function calculateSafetyStockTrace(input: SafetyStockInput) {
  const reasonCodes: string[] = [];
  if (input.forecastQty === null) reasonCodes.push('NO_FORECAST');
  if (input.leadTime === null) reasonCodes.push('NO_LEADTIME');
  if (input.demandSigma === null || input.demandPerPeriod === null) reasonCodes.push('INSUFFICIENT_FORECAST_ERROR');
  if (input.leadTimeSigma === null) reasonCodes.push('INSUFFICIENT_LEADTIME_SAMPLE');
  if (input.zValue === null) reasonCodes.push('NO_SERVICE_LEVEL');
  if (input.availableInventory === null) reasonCodes.push('NO_INVENTORY_DATA');
  if (input.moq === null || input.packSize === null) reasonCodes.push('NO_ITEM_POLICY');
  if (reasonCodes.length > 0) return { sigmaDlt: null, safetyStock: null, demandBasisQty: null, requiredQty: null, recommendedQty: null, calculationStatus: 'CALCULATION_UNAVAILABLE' as const, reasonCodes };

  const demandBasisQty = Math.max(input.forecastQty!, input.confirmedOrderQty ?? 0);
  const sigmaDlt = Math.sqrt(input.leadTime! * input.demandSigma! ** 2 + input.demandPerPeriod! ** 2 * input.leadTimeSigma! ** 2);
  const safetyStock = round(sigmaDlt * input.zValue!);
  const requiredQty = round(demandBasisQty + safetyStock - input.availableInventory! - (input.scheduledReceipt ?? 0));
  if (requiredQty <= 0) return { sigmaDlt: round(sigmaDlt), safetyStock, demandBasisQty, requiredQty, recommendedQty: 0, calculationStatus: 'CALCULATED_NO_ORDER' as const, reasonCodes: [] };
  const moqApplied = Math.max(requiredQty, input.moq!);
  const recommendedQty = round(Math.ceil(moqApplied / input.packSize!) * input.packSize!);
  return { sigmaDlt: round(sigmaDlt), safetyStock, demandBasisQty, requiredQty, recommendedQty, calculationStatus: 'CALCULATED' as const, reasonCodes: [] };
}

export function normalizePurchaseRecommendation(row: Record<string, unknown>) {
  const numberValue = (keys: string[]) => { const value = keys.map((key) => row[key]).find((value) => value !== null && value !== undefined && value !== ''); return value === undefined ? null : Number(value); };
  const value = (keys: string[]) => keys.map((key) => row[key]).find((item) => item !== null && item !== undefined) ?? null;
  return {
    itemId: String(value(['item_id']) ?? '미정'), itemName: value(['item_name']) as string | null, itemGrade: value(['item_grade']) as string | null,
    forecastQty: numberValue(['forecast_qty']), confirmedOrderQty: numberValue(['confirmed_order_qty']), demandBasisQty: numberValue(['demand_basis_qty']),
    availableInventory: numberValue(['available_inventory']), scheduledReceipt: numberValue(['scheduled_receipt']), safetyStock: numberValue(['safety_stock']),
    effectiveLeadtime: numberValue(['effective_leadtime']), stockoutDate: value(['stockout_date']) as string | null, safetyBufferDays: numberValue(['safety_buffer_days']),
    requiredQty: numberValue(['required_qty']), moq: numberValue(['moq']), packSize: numberValue(['pack_size']), recommendedQty: numberValue(['recommended_qty']),
    recommendedOrderDate: value(['recommended_order_date']) as string | null, immediateOrder: Boolean(value(['immediate_order'])), overdue: Boolean(value(['overdue'])),
    riskStatus: String(value(['risk_status']) ?? 'CALCULATION_UNAVAILABLE'), calculationStatus: String(value(['calculation_status']) ?? 'CALCULATION_UNAVAILABLE'),
    reasonCode: value(['reason_code']) as string | null, forecastRunId: value(['forecast_run_id']) as string | null, modelVersion: value(['model_version']) as string | null,
    demandPerPeriod: numberValue(['demand_per_period']), demandSigma: numberValue(['demand_sigma']), leadtimeSigma: numberValue(['leadtime_sigma']),
    serviceLevel: numberValue(['service_level']), zValue: numberValue(['z_value']), sigmaDlt: numberValue(['sigma_dlt']), calculationTrace: (value(['calculation_trace']) as Record<string, unknown> | null),
  };
}

function round(value: number): number { return Math.round(value * 100) / 100; }
