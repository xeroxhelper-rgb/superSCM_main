import WorkflowScreen from '@/components/workflow/workflow-screen';
import { workflowStepFromParam } from '@/lib/menu';

export const dynamic = 'force-dynamic';

export default async function WorkflowPage({ searchParams }: { searchParams: Promise<{ step?: string | string[] }> }) {
  const params = await searchParams;
  return <WorkflowScreen initialStep={workflowStepFromParam(params.step)} />;
}
