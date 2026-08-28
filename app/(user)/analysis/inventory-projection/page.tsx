import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import Badge from '@/components/ui/badge';
import InventoryProjectionTable from '@/components/analysis/inventory-projection-table';
import { getInventoryProjection } from '@/lib/scm';

export const dynamic = 'force-dynamic';

export default async function InventoryProjectionPage({ searchParams }: { searchParams: Promise<{ item_id?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const { rows, error } = await getInventoryProjection({ itemId: params.item_id, from: params.from, to: params.to });
  return <>
    <PageHeader eyebrow="ANALYSIS / INVENTORY PROJECTION" title="재고 Projection" description="Champion Forecast와 예정 입고·확정수주·가예약을 반영한 기간별 재고 흐름입니다." action={<Badge status="info">DB CALCULATION</Badge>} />
    <Panel title="기간별 Inventory Projection" meta={`${rows.length}행`}><InventoryProjectionTable rows={rows} error={error} /></Panel>
  </>;
}
