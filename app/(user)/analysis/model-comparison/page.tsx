import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import ModelComparisonView from '@/components/analysis/model-comparison-view';
import { getModelComparison } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function ModelComparisonPage() {
  const result = await getModelComparison();
  return <><PageHeader eyebrow="ANALYSIS / MODEL COMPARISON" title="Forecast 모델 비교" description="검증기간 Actual과 저장된 Forecast Result의 모델별 성능을 비교합니다." action={<Badge status="info">VALIDATION PERIOD</Badge>} /><Panel title="Actual vs Forecast" meta="SAVED RESULTS ONLY"><ModelComparisonView points={result.rows} error={result.error} /></Panel></>;
}
