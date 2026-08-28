export type ProjectionRiskStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'CALCULATION_UNAVAILABLE';

export type ProjectionRiskInput = {
  stockoutPeriod: string | null;
  leadTimeDays: number | null;
  stockoutLeadDays: number | null;
};

export function classifyProjectionRisk(input: ProjectionRiskInput): ProjectionRiskStatus {
  if (input.leadTimeDays === null || (input.stockoutPeriod !== null && input.stockoutLeadDays === null)) return 'CALCULATION_UNAVAILABLE';
  if (input.stockoutPeriod === null) return 'SAFE';
  return input.stockoutLeadDays! <= input.leadTimeDays ? 'CRITICAL' : 'WARNING';
}
