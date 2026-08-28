import ProcurementApp from '@/components/procurement-app';
import { workflowStepFromParam } from '@/lib/menu';

export default async function LegacyWorkflowPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const params = await searchParams;
  return <ProcurementApp initialStep={workflowStepFromParam(params.step)} />;
}
