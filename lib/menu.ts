import type { LucideIcon } from 'lucide-react';
import { BarChart3, Boxes, CalendarRange, FileText, FileUp, Gauge, LineChart, Settings2, ShieldCheck, ShoppingCart, Users, WandSparkles, History } from 'lucide-react';

export type MenuRole = 'user' | 'admin';
export type MenuStatus = 'ready' | 'locked';
export type MenuSection = 'WORKFLOW' | 'ANALYSIS' | 'ADMIN';
export type WorkflowStep = 'dashboard' | 'demand' | 'supply' | 'master' | 'calculation' | 'report';

export type MenuItem = {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  section: MenuSection;
  status?: MenuStatus;
  matchPrefix?: string;
};

export const analysisMenuItems = [
  { href: '/analysis/leadtime', label: '리드타임 격차', description: '공급처별 계획과 실제 리드타임 비교', icon: LineChart, section: 'ANALYSIS' },
  { href: '/analysis/stockout', label: '재고 소진 위험', description: '가용재고와 계획 리드타임 기준 위험 분석', icon: Boxes, section: 'ANALYSIS' },
  { href: '/analysis/demand-profile', label: 'SKU 수요 프로파일', description: 'SKU별 수요 패턴과 안정성 분석', icon: BarChart3, section: 'ANALYSIS' },
  { href: '/analysis/model-comparison', label: 'Forecast 모델 비교', description: '모델별 검증 성능과 Champion 비교', icon: WandSparkles, section: 'ANALYSIS' },
] satisfies readonly MenuItem[];

export const menuByRole: Record<MenuRole, MenuItem[]> = {
  user: [
    { href: '/', label: '전체 현황', description: '월간 발주계획 요약', icon: Gauge, section: 'WORKFLOW' },
    { href: '/workflow?step=demand', label: '수요 확정', description: '수요 입력 및 확정', icon: BarChart3, section: 'WORKFLOW' },
    { href: '/workflow?step=supply', label: '재고·공급', description: '재고와 Open PO 확인', icon: Boxes, section: 'WORKFLOW' },
    { href: '/workflow?step=master', label: '마스터 검증', description: '계산 기준 검증', icon: Settings2, section: 'WORKFLOW' },
    { href: '/workflow?step=calculation', label: '발주량 계산', description: '계산 결과와 예외 검토', icon: ShoppingCart, section: 'WORKFLOW' },
    { href: '/workflow?step=report', label: '보고자료', description: '경영 보고자료 확인', icon: FileText, section: 'WORKFLOW' },
    ...analysisMenuItems,
  ],
  admin: [
    { href: '/admin', label: '관리자 현황', description: '기준·운영 상태', icon: ShieldCheck, section: 'ADMIN' },
    { href: '/admin/masters', label: '마스터 관리', description: '품목·공급처 기준', icon: Settings2, section: 'ADMIN', status: 'locked' },
    { href: '/admin/users', label: '사용자 관리', description: '계정과 권한 관리', icon: Users, section: 'ADMIN' },
    { href: '/admin/forecast-settings', label: 'Forecast 설정', description: '학습·검증 기간 확인', icon: CalendarRange, section: 'ADMIN' },
    { href: '/admin/data-management', label: 'Data Management', description: '파일 적재와 검증 이력', icon: FileUp, section: 'ADMIN' },
    { href: '/admin/forecast-models', label: 'Forecast 모델', description: 'Baseline 모델 설정', icon: WandSparkles, section: 'ADMIN' },
    { href: '/admin/forecast-runs', label: 'Forecast 실행 이력', description: '실행 결과와 stale 상태', icon: History, section: 'ADMIN' },
    { href: '/admin/backtest-runs', label: 'Backtest 실행', description: '검증 성능 계산 실행', icon: History, section: 'ADMIN' },
    { href: '/admin/champions', label: 'Champion 관리', description: '모델 선정과 변경 이력', icon: WandSparkles, section: 'ADMIN' },
    { href: '/admin/python-forecast', label: 'Python Forecast', description: '고급 모델 배치 실행', icon: WandSparkles, section: 'ADMIN' },
  ],
};

const workflowSteps: WorkflowStep[] = ['dashboard', 'demand', 'supply', 'master', 'calculation', 'report'];

export function workflowStepFromParam(value: string | string[] | undefined): WorkflowStep {
  if (typeof value !== 'string') return 'dashboard';
  return workflowSteps.includes(value as WorkflowStep) ? value as WorkflowStep : 'dashboard';
}
