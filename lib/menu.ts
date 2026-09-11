import type { LucideIcon } from 'lucide-react';
import { BarChart3, Boxes, Database, FileText, Gauge, LineChart, Settings2, ShieldCheck, ShoppingCart, Users, Workflow, Bot } from 'lucide-react';

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

export const menuByRole: Record<MenuRole, MenuItem[]> = {
  user: [
    { href: '/dashboard', label: '전체 현황', description: '월간 발주계획 요약', icon: Gauge, section: 'WORKFLOW' },
    { href: '/workflow?step=demand', label: '수요 확정', description: '수요 입력 및 확정', icon: BarChart3, section: 'WORKFLOW' },
    { href: '/workflow?step=supply', label: '재고·공급', description: '재고와 Open PO 확인', icon: Boxes, section: 'WORKFLOW' },
    { href: '/workflow?step=master', label: '마스터 검증', description: '계산 기준 검증', icon: Settings2, section: 'WORKFLOW' },
    { href: '/workflow?step=calculation', label: '발주량 계산', description: '계산 결과와 예외 검토', icon: ShoppingCart, section: 'WORKFLOW' },
    { href: '/workflow?step=report', label: '보고자료', description: '경영 보고자료 확인', icon: FileText, section: 'WORKFLOW' },
    { href: '/analysis/leadtime', label: '분석 화면', description: '리드타임과 재고 위험 분석', icon: LineChart, section: 'ANALYSIS', matchPrefix: '/analysis' },
    { href: '/analysis/demand-profile', label: '수요 패턴', description: '출고 실적 기반 수요 성격 분류', icon: BarChart3, section: 'ANALYSIS', matchPrefix: '/analysis/demand-profile' },
    { href: '/analysis/model-comparison', label: 'OL 예측 정확도', description: '영업 OL과 SCM OL 정확도', icon: LineChart, section: 'ANALYSIS', matchPrefix: '/analysis/model-comparison' },
    { href: '/analysis/stockout', label: '재고 소진 위험', description: '재고 소진 예상과 위험 품목', icon: Boxes, section: 'ANALYSIS', matchPrefix: '/analysis/stockout' },
    { href: '/agent', label: 'SCM Agent', description: '데이터 기반 질문과 근거 확인', icon: LineChart, section: 'ANALYSIS', matchPrefix: '/agent' },
  ],
  admin: [
    { href: '/admin', label: '관리자 현황', description: '기준·운영 상태', icon: ShieldCheck, section: 'ADMIN' },
    { href: '/admin/masters', label: '마스터 관리', description: '품목·공급처 기준', icon: Settings2, section: 'ADMIN', status: 'locked' },
    { href: '/admin/users', label: '사용자 관리', description: '계정과 권한 관리', icon: Users, section: 'ADMIN' },
    { href: '/admin/workflow', label: '발주계획 관리', description: '레거시 업무 플로우', icon: Workflow, section: 'ADMIN' },
    { href: '/admin/demand', label: '수요 관리', description: '수요 데이터 관리', icon: BarChart3, section: 'ADMIN' },
    { href: '/admin/data-management', label: '데이터 관리', description: '파일 적재와 검증', icon: Database, section: 'ADMIN' },
    { href: '/admin/forecast-models', label: 'Forecast Models', description: '예측 모델 설정', icon: Bot, section: 'ADMIN' },
    { href: '/admin/forecast-runs', label: 'Forecast Runs', description: '예측 실행 이력', icon: Bot, section: 'ADMIN' },
    { href: '/admin/backtest-runs', label: 'Backtest Runs', description: '검증 실행 이력', icon: Bot, section: 'ADMIN' },
    { href: '/admin/champion-models', label: 'Champion Models', description: '대표 모델 선정', icon: Bot, section: 'ADMIN' },
    { href: '/admin/settings', label: '시스템 설정', description: '관리자 설정', icon: Settings2, section: 'ADMIN' },
  ],
};

export const USER_MENU = menuByRole.user;
export const ADMIN_MENU = menuByRole.admin;

export function isMenuItemActive(pathname: string, search: string, item: MenuItem): boolean {
  if (item.matchPrefix && pathname.startsWith(item.matchPrefix)) return true;
  const target = new URL(item.href, 'http://localhost');
  if (target.pathname !== pathname) return false;
  return target.search === '' || target.search === search;
}

export function menuForRole(role: 'ADMIN' | 'USER'): MenuItem[] {
  return role === 'ADMIN' ? [...USER_MENU, ...ADMIN_MENU] : USER_MENU;
}

export const analysisMenuItems = [
  { href: '/analysis/demand-profile', label: '수요 패턴' },
  { href: '/analysis/model-comparison', label: 'OL 예측 정확도' },
  { href: '/analysis/leadtime', label: '리드타임 격차' },
  { href: '/analysis/stockout', label: '재고 소진 위험' },
] as const;

const workflowSteps: WorkflowStep[] = ['dashboard', 'demand', 'supply', 'master', 'calculation', 'report'];

export function workflowStepFromParam(value: string | string[] | undefined): WorkflowStep {
  if (typeof value !== 'string') return 'dashboard';
  return workflowSteps.includes(value as WorkflowStep) ? value as WorkflowStep : 'dashboard';
}
