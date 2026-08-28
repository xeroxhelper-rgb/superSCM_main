import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import BacktestRunsTable from '@/components/admin/backtest-runs-table';
import { getBacktestRuns, getForecastRuns } from '@/lib/scm';

export const dynamic = 'force-dynamic';
export default async function BacktestRunsPage() { const [backtests, forecasts] = await Promise.all([getBacktestRuns(), getForecastRuns()]); return <><PageHeader eyebrow="ADMIN / BACKTEST" title="Backtest 실행" description="저장된 Forecast Result를 검증기간 Actual과 비교해 성능을 계산합니다." /><Panel title="검증 실행 및 이력" meta="FORECAST RESULT + TEST ACTUAL"><BacktestRunsTable rows={backtests.rows} forecastRuns={forecasts.rows} error={backtests.error ?? forecasts.error} /></Panel></>; }
