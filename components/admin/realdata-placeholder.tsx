import PageHeader from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import InsightBanner from '@/components/ui/insight-banner';
import Panel from '@/components/ui/panel';

export default function RealDataPlaceholder({ title, description, view }: { title: string; description: string; view: string }) {
  return <section className="analysis-page"><PageHeader eyebrow="ADMIN / OPERATIONS" title={title} description={description} action={<Badge status="info">ADMIN ONLY</Badge>} /><Panel title="준비된 운영 경계" meta={view}><InsightBanner title="실데이터 운영 화면 준비 중">DB 객체와 권한 계약을 먼저 확인한 뒤 이 화면에 조회·변경 기능을 연결합니다. 계산값은 화면에서 임의로 생성하지 않습니다.</InsightBanner></Panel></section>;
}
