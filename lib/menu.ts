import type { LucideIcon } from 'lucide-react';
import { BarChart3, Boxes, Gauge, Settings2, ShieldCheck } from 'lucide-react';

export type MenuRole = 'user' | 'admin';
export type MenuStatus = 'ready' | 'locked';

export type MenuItem = {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  status?: MenuStatus;
};

export const menuByRole: Record<MenuRole, MenuItem[]> = {
  user: [
    { href: '/', label: '전체 현황', description: '월간 발주계획 요약', icon: Gauge },
    { href: '/analysis/leadtime', label: '리드타임 격차', description: '공급처별 실적 비교', icon: BarChart3 },
    { href: '/analysis/stockout', label: '재고 소진 위험', description: '품목별 위험 확인', icon: Boxes },
  ],
  admin: [
    { href: '/admin', label: '관리자 현황', description: '기준·운영 상태', icon: ShieldCheck },
    { href: '/admin/masters', label: '마스터 관리', description: '품목·공급처 기준', icon: Settings2, status: 'locked' },
  ],
};
