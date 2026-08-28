import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';

export default function AdminMastersPage() {
  return <><PageHeader eyebrow="ADMIN / MASTER DATA" title="마스터 관리" description="품목·공급처·리드타임 기준을 관리하는 화면입니다." /><Panel title="준비 중" meta={<Badge status="calculation_unavailable">LOCKED</Badge>}><p className="muted-ui">Phase 2에서 실제 입력·업로드 기능을 연결합니다.</p></Panel></>;
}
