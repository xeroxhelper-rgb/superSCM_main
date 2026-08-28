import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import ChampionsTable from '@/components/admin/champions-table';
import { getChampions } from '@/lib/scm';

export const dynamic = 'force-dynamic';
export default async function ChampionsPage() { const result = await getChampions(); return <><PageHeader eyebrow="ADMIN / CHAMPION" title="Champion Model 관리" description="SKU별 자동 선정 결과와 후보 성능 snapshot을 확인합니다." /><Panel title="현재 Champion" meta="AUTO / MANUAL HISTORY"><ChampionsTable rows={result.rows} error={result.error} /></Panel></>; }
