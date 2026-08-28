'use client';

import DataTable from '@/components/ui/data-table';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import { canRollback } from '@/lib/import/history';
import type { ImportHistoryRow } from '@/lib/import/repository-types';

export default function ImportHistoryTable({ rows, isAdmin }: { rows: ImportHistoryRow[]; isAdmin: boolean }) {
  async function rollback(batchId: string) {
    if (!window.confirm('이 batch의 적재 데이터를 rollback할까요?')) return;
    await fetch('/api/import/rollback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId }) });
    window.location.reload();
  }
  return <DataTable rowKey={(row) => row.batchId} rows={rows} columns={[
    { key: 'fileName', label: '파일명' }, { key: 'importType', label: '타입' }, { key: 'importMode', label: '모드' },
    { key: 'totalRows', label: '총 행', align: 'right' }, { key: 'successRows', label: '성공', align: 'right' },
    { key: 'warningRows', label: '경고', align: 'right' }, { key: 'errorRows', label: '오류', align: 'right' },
    { key: 'uploader', label: '사용자' }, { key: 'uploadedAt', label: '시간' },
    { key: 'status', label: '상태', render: (row) => <Badge status={row.status === 'IMPORTED' ? 'safe' : row.status === 'FAILED' ? 'critical' : 'warning'}>{row.status}</Badge> },
    { key: 'actions', label: '작업', render: (row) => <span className="import-actions"><a href={`/api/import/errors/${row.batchId}`}>오류 CSV</a>{canRollback(row, isAdmin) && <Button type="button" variant="danger" onClick={() => rollback(row.batchId)}>Rollback</Button>}</span> },
  ]} />;
}
