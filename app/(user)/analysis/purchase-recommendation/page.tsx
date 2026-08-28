import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import PurchaseRecommendationTable from '@/components/analysis/purchase-recommendation-table';
import { getPurchaseRecommendations } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function PurchaseRecommendationPage() {
  const { rows, error } = await getPurchaseRecommendations();
  return <>
    <PageHeader eyebrow="ANALYSIS / PURCHASE RECOMMENDATION" title="발주 추천" description="Forecast Accuracy, Inventory Projection, Safety Stock과 구매 정책을 결합한 SKU별 발주 추천입니다." action={<Badge status="info">DB CALCULATION</Badge>} />
    <Panel title="SKU별 발주 추천" meta={`${rows.length}개 품목`}><PurchaseRecommendationTable rows={rows} error={error} /></Panel>
  </>;
}
