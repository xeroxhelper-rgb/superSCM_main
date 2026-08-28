import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import LeadtimePolicyTable, { LeadtimeHistoryTable } from '@/components/admin/leadtime-policy-table';
import { requireAdmin } from '@/lib/auth';
import { getLeadtimePolicy, getLeadtimePolicyHistory } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function LeadtimePolicyPage() {
  await requireAdmin();
  const [policies, history] = await Promise.all([getLeadtimePolicy(), getLeadtimePolicyHistory()]);
  return <>
    <PageHeader eyebrow="ADMIN / SCM POLICIES / LEAD TIME" title="Lead Time 정책" description="관리자 확정값을 실적 P80보다 우선 적용하고 변경 이력을 보존합니다." action={<Badge status="info">ADMIN ONLY</Badge>} />
    <Panel title="공급처별 Lead Time" meta="EFFECTIVE POLICY"><LeadtimePolicyTable rows={policies.rows} error={policies.error} /></Panel>
    <Panel title="변경 이력" meta="AUDIT TRAIL"><LeadtimeHistoryTable rows={history.rows} error={history.error} /></Panel>
  </>;
}
