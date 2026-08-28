import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import ImportWizard from '@/components/admin/import-wizard';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DataManagementPage() {
  await requireAdmin();
  return <>
    <PageHeader eyebrow="ADMIN / DATA" title="Data Management" description="파일을 검증한 뒤 승인된 데이터만 RAW 계층에 적재합니다." />
    <Panel title="File Upload" meta="Validation 후 Import">
      <ImportWizard />
    </Panel>
  </>;
}
