import PageHeader from '@/components/shell/page-header';
import KpiCard from '@/components/ui/kpi-card';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import Link from 'next/link';

export default function AdminPage() {
  return <><PageHeader eyebrow="ADMIN / CONTROL" title="기준 데이터 관리" description="공급처·리드타임·사용량 기준의 운영 상태를 확인합니다." /><div className="kpi-grid"><KpiCard label="분석 뷰" value="5" foot="analytics 스키마" status="safe" /><KpiCard label="기준 테이블" value="2" foot="core 확정값" status="info" /><KpiCard label="인증 상태" value="ACTIVE" foot="SSR + RLS" status="safe" /><KpiCard label="환경 상태" value="LIVE" foot="Supabase 연결 설정" status="safe" /></div><Panel title="관리 메뉴" meta="ADMIN"><p className="muted-ui"><Badge status="info">USER MANAGEMENT</Badge> <Link href="/admin/users">사용자와 권한 관리</Link></p></Panel></>;
}
