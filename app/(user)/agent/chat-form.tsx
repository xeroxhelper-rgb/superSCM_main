'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Badge from '@/components/ui/badge';
import Button from '@/components/ui/button';
import EmptyValue from '@/components/ui/empty-value';
import Panel from '@/components/ui/panel';
import type { AgentAnswer } from '@/lib/agent/schema';
import { askAgent } from './actions';
import { initialAgentState } from './state';

const examples = [
  '602K02693의 최근 출고 추세를 알려줘',
  'MDL121의 BOM 요구량을 확인해줘',
  '재고 소진 위험이 높은 품목을 설명해줘',
  '현재 데이터로 발주 검토가 필요한 항목을 알려줘',
];

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="primary" disabled={disabled || pending}>{pending ? '분석 중…' : '질문 보내기'}</Button>;
}

function riskTone(risk: AgentAnswer['risk']): 'safe' | 'warning' | 'critical' | 'calculation_unavailable' | 'info' {
  if (risk === 'SAFE') return 'safe';
  if (risk === 'WARNING') return 'warning';
  if (risk === 'CRITICAL') return 'critical';
  return 'calculation_unavailable';
}

function AnswerCard({ answer }: { answer: AgentAnswer }) {
  return <div className="agent-result-stack">
    <Panel title="Structured Answer" meta={<Badge status={riskTone(answer.risk)}>{answer.risk}</Badge>}>
      <p className="agent-answer">{answer.answer}</p>
      <div className="agent-meta-grid">
        <div><span className="metric-label">판정</span><strong>{answer.verdict}</strong></div>
        <div><span className="metric-label">데이터 기준시각</span>{answer.data_as_of ? <strong>{answer.data_as_of}</strong> : <EmptyValue reason="DATA_AS_OF_UNAVAILABLE" />}</div>
      </div>
    </Panel>
    <Panel title="근거" meta={`${answer.evidence.length}건`}>
      {answer.evidence.length ? <div className="agent-evidence-grid">{answer.evidence.map((item, index) => <article className="agent-evidence-tile" key={`${item.source}-${index}`}><strong>{item.source}</strong><span>{item.claim}</span>{item.value !== null ? <span className="metric">{item.value}</span> : <EmptyValue reason="VALUE_UNAVAILABLE" />}</article>)}</div> : <p className="muted">답변에 연결된 근거가 없습니다.</p>}
    </Panel>
    <Panel title="권고 및 상태">
      <div className="agent-meta-grid"><div><span className="metric-label">권고</span>{answer.recommended_action ? <strong>{answer.recommended_action}</strong> : <EmptyValue reason="NO_RECOMMENDATION" />}</div><div><span className="metric-label">계산 불가 사유</span>{answer.cannot_answer_reason ? <strong>{answer.cannot_answer_reason}</strong> : <span className="muted">없음</span>}</div></div>
    </Panel>
  </div>;
}

export default function ChatForm({ configured }: { configured: boolean }) {
  const [state, formAction] = useActionState(askAgent, { ...initialAgentState, configured });
  return <div className="agent-workspace">
    <form action={formAction} className="agent-form">
      <label htmlFor="agent-question">무엇을 확인할까요?</label>
      <textarea id="agent-question" name="question" rows={4} placeholder="예: 602K02693의 최근 출고 추세와 주의할 점을 알려줘" disabled={!configured} required />
      <div className="agent-examples" aria-label="예시 질문">{examples.map((example) => <button type="button" className="agent-example" key={example} disabled={!configured} onClick={(event) => { const form = event.currentTarget.form; const input = form?.elements.namedItem('question'); if (input instanceof HTMLTextAreaElement) input.value = example; }}>{example}</button>)}</div>
      <div className="button-row"><SubmitButton disabled={!configured} />{!configured && <span className="muted">OpenAI 환경변수 설정 후 질문할 수 있습니다.</span>}</div>
    </form>
    {state.error && <Panel title="오류"><p className="text-danger">{state.error}</p></Panel>}
    {state.answer && <AnswerCard answer={state.answer} />}
    {state.trace.length > 0 && <details className="agent-trace"><summary>Tool trace ({state.trace.length})</summary><ol>{state.trace.map((item, index) => <li key={`${item.name}-${index}`}><strong>{item.name}</strong><code>{JSON.stringify(item.args)}</code><span>{item.ok ? '성공' : '실패'} · {item.ms}ms{item.reason ? ` · ${item.reason}` : ''}</span></li>)}</ol></details>}
  </div>;
}
