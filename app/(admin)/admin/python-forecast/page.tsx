import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import PythonForecastPanel from '@/components/admin/python-forecast-panel';
import { getForecastModels } from '@/lib/scm';

export const dynamic = 'force-dynamic';
export default async function PythonForecastPage() { const result = await getForecastModels(); return <><PageHeader eyebrow="ADMIN / PYTHON FORECAST" title="Python Forecast Service" description="Python 고급 모델을 별도 배치 서비스에서 실행하고 저장 결과를 기존 Forecast 화면에 편입합니다." /><Panel title="Python Model Registry" meta="SERVICE ADAPTER"><PythonForecastPanel models={result.rows} /></Panel>{result.error && <p className="empty-state-ui"><strong>모델 조회에 실패했습니다.</strong><br />{result.error}</p>}</>; }
