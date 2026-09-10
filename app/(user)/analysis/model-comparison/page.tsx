import PageHeader from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import DataTable, { type UiColumn } from '@/components/ui/data-table';
import EmptyValue from '@/components/ui/empty-value';
import Panel from '@/components/ui/panel';
import { getOlAccuracy } from '@/lib/scm';
import type { OlAccuracy } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

const columns: UiColumn<OlAccuracy>[] = [
  { key: 'modelBase', label: '기종/모델', render: (row) => row.modelBase ?? <EmptyValue reason="NO_MODEL" /> },
  { key: 'fiscalYear', label: '회계연도', render: (row) => row.fiscalYear ?? <EmptyValue reason="NO_FY" /> },
  { key: 'olType', label: '구분', render: (row) => row.olType ?? <EmptyValue reason="NO_OL_TYPE" /> },
  { key: 'wape', label: 'WAPE', align: 'right', render: (row) => row.wape === null ? <EmptyValue reason={row.reasonCode ?? 'NO_WAPE'} /> : `${(row.wape * 100).toFixed(1)}%` },
  { key: 'bias', label: 'Bias', align: 'right', render: (row) => row.bias === null ? <EmptyValue reason={row.reasonCode ?? 'NO_BIAS'} /> : row.bias.toFixed(2) },
];

export default async function ModelComparisonPage() {
  const { rows, error } = await getOlAccuracy('ALL', null);
  return <><PageHeader eyebrow="ANALYSIS / MODEL COMPARISON" title="OL 예측 정확도" description="실적과 예측의 오차를 비교합니다. 양수 Bias는 과대예측입니다." action={<Badge status="info">BIAS = FORECAST − ACTUAL</Badge>} /><Panel title="Model Performance" meta="WAPE · Bias"><DataTable columns={columns} rows={rows} error={error} rowKey={(row, index) => `${row.modelBase}-${row.olType}-${index}`} empty="OL 정확도 결과가 없습니다. 실데이터 View와 기간 설정을 확인하세요." /></Panel></>;
}
