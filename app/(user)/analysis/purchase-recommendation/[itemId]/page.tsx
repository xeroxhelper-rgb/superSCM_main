import Link from 'next/link';
import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import EmptyValue from '@/components/ui/empty-value';
import { getInventoryProjection, getPurchaseRecommendation } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function PurchaseRecommendationDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const [{ rows: recommendations, error: recommendationError }, { rows: projection, error: projectionError }] = await Promise.all([getPurchaseRecommendation(decodeURIComponent(itemId)), getInventoryProjection({ itemId: decodeURIComponent(itemId) })]);
  const recommendation = recommendations[0];
  const error = recommendationError ?? projectionError;
  return <>
    <PageHeader eyebrow="ANALYSIS / SKU DETAIL" title={recommendation?.itemName ?? decodeURIComponent(itemId)} description="Forecast → Inventory Projection → Safety Stock → Stockout → Purchase Recommendation 흐름입니다." action={<Link className="button" href="/analysis/purchase-recommendation">목록으로</Link>} />
    {error && <p className="empty-state-ui">조회에 실패했습니다: {error}</p>}
    {!error && !recommendation && <p className="empty-state-ui">표시할 추천 데이터가 없습니다.</p>}
    {recommendation && <div className="content-grid">
      <Panel title="Purchase Recommendation" meta={recommendation.calculationStatus}>
        <dl className="detail-list">
          <dt>Forecast</dt><dd>{recommendation.forecastQty ?? <EmptyValue reason={recommendation.reasonCode} />}</dd>
          <dt>Demand Basis</dt><dd>{recommendation.demandBasisQty ?? <EmptyValue reason={recommendation.reasonCode} />}</dd>
          <dt>Safety Stock</dt><dd>{recommendation.safetyStock ?? <EmptyValue reason={recommendation.reasonCode} />}</dd>
          <dt>Inventory / Open PO</dt><dd>{recommendation.availableInventory ?? <EmptyValue reason={recommendation.reasonCode} />} / {recommendation.scheduledReceipt ?? <EmptyValue reason={recommendation.reasonCode} />}</dd>
          <dt>Required / Recommended</dt><dd>{recommendation.requiredQty ?? <EmptyValue reason={recommendation.reasonCode} />} / {recommendation.recommendedQty ?? <EmptyValue reason={recommendation.reasonCode} />}</dd>
          <dt>MOQ / Pack Size</dt><dd>{recommendation.moq ?? <EmptyValue reason={recommendation.reasonCode} />} / {recommendation.packSize ?? <EmptyValue reason={recommendation.reasonCode} />}</dd>
          <dt>발주권고일</dt><dd>{recommendation.recommendedOrderDate ?? <EmptyValue reason={recommendation.reasonCode} />}{recommendation.immediateOrder && ' · 즉시 발주'}</dd>
        </dl>
      </Panel>
      <Panel title="Inventory Projection" meta={`${projection.length}기간`}>
        <div className="detail-list"><p>예측과 입고·확정수주·가예약을 반영한 STEP 9 Projection 결과입니다.</p><p>{projection.length ? `${projection[0].period}부터 ${projection[projection.length - 1].period}까지 조회되었습니다.` : 'Projection 데이터가 없습니다.'}</p></div>
      </Panel>
    </div>}
  </>;
}
