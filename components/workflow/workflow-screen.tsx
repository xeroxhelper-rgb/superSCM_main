'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CalculationStep from '@/components/workflow/calculation-step';
import DemandStep from '@/components/workflow/demand-step';
import MasterStep from '@/components/workflow/master-step';
import ReportStep from '@/components/workflow/report-step';
import SupplyStep from '@/components/workflow/supply-step';
import type { WorkflowStep } from '@/lib/menu';

const steps: WorkflowStep[] = ['dashboard', 'demand', 'supply', 'master', 'calculation', 'report'];

export default function WorkflowScreen({ initialStep }: { initialStep: WorkflowStep }) {
  const router = useRouter();
  const [active, setActive] = useState(initialStep);

  useEffect(() => setActive(initialStep), [initialStep]);

  const navigate = (step: WorkflowStep) => {
    setActive(step);
    router.push(step === 'dashboard' ? '/workflow' : `/workflow?step=${step}`);
  };
  const currentIndex = steps.indexOf(active);
  const onNext = () => navigate(steps[Math.min(currentIndex + 1, steps.length - 1)]);
  const onBack = () => navigate(steps[Math.max(currentIndex - 1, 0)]);

  const page = useMemo(() => {
    const props = { onNext, onBack };
    switch (active) {
      case 'demand': return <DemandStep {...props} />;
      case 'supply': return <SupplyStep {...props} />;
      case 'master': return <MasterStep {...props} />;
      case 'calculation': return <CalculationStep {...props} />;
      case 'report': return <ReportStep {...props} />;
      default: return <div className="card"><h2>전체 현황</h2><p className="muted">월간 발주계획의 전체 진행 상태를 확인합니다.</p></div>;
    }
  }, [active]);

  return <section className="workflow-screen">{page}</section>;
}
