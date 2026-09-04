import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import ChatForm from './chat-form';

export const dynamic = 'force-dynamic';

export default async function AgentPage() {
  const user = await requireUser();
  void user;
  const configured = Boolean(process.env.OPENAI_BASE_URL?.trim() && process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim());
  return <section className="analysis-page agent-page"><PageHeader eyebrow="AI WORKSPACE" title="SCM Agent" description="저장된 SCM 분석 결과를 근거와 함께 질문하고 확인합니다." /><ChatForm configured={configured} /></section>;
}
