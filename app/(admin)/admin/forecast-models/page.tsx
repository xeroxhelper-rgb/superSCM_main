import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import ForecastModelsTable from '@/components/admin/forecast-models-table';
import { getForecastModels } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function ForecastModelsPage() {
  const result = await getForecastModels();
  return <><PageHeader eyebrow="ADMIN / FORECAST" title="Forecast 모델 관리" description="Baseline 모델의 활성 상태와 DB parameters를 관리합니다." /><Panel title="Model Registry" meta="SQL BASELINE"><ForecastModelsTable rows={result.rows} error={result.error} /></Panel></>;
}
