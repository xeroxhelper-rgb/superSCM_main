import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Button from '@/components/ui/button';
import ForecastRunsTable from '@/components/admin/forecast-runs-table';
import { runBaselineForecastAction } from './actions';
import { getForecastRuns } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function ForecastRunsPage() {
  const result = await getForecastRuns();
  return <><PageHeader eyebrow="ADMIN / FORECAST" title="Forecast 실행 이력" description="실행 결과와 모델 snapshot, 데이터 변경 여부를 확인합니다." action={<form action={runBaselineForecastAction}><Button type="submit">Baseline Forecast 실행</Button></form>} /><Panel title="Forecast Runs" meta="RUN HISTORY"><ForecastRunsTable rows={result.rows} error={result.error} /></Panel></>;
}
