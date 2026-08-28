'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/button';
import Badge from '@/components/ui/badge';
import DataTable from '@/components/ui/data-table';
import { getImportSchema, getSupportedImportTypes } from '@/lib/import/schema';
import type { ColumnMapping, ImportMode, ImportType } from '@/lib/import/types';

type ParsedState = { batchId: string; headers: string[]; preview: Record<string, string>[]; totalRows: number };
type ValidationState = { rows: Array<{ rowNumber: number; status: string }>; issues: Array<{ rowNumber: number; fieldName: string; errorCode: string; errorMessage: string; severity: 'ERROR' | 'WARNING'; originalValue: string }>; successRows: number; warningRows: number; errorRows: number; canImport: boolean };

export default function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<ImportType>('usage_history');
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const schema = useMemo(() => getImportSchema(importType), [importType]);

  async function parseFile() {
    if (!file) return;
    setMessage(null);
    const form = new FormData();
    form.set('file', file);
    form.set('importType', importType);
    form.set('importMode', importMode);
    const response = await fetch('/api/import/parse', { method: 'POST', body: form });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error ?? '파일 파싱에 실패했습니다.');
    setParsed(body);
    setMapping(body.headers.map((sourceColumn: string) => ({ sourceColumn, targetColumn: schema.fields.find((field) => [field.name, field.dbColumn, ...field.aliases].includes(sourceColumn))?.name ?? null, confidence: 0 })));
    setValidation(null);
    setConfirmed(false);
  }

  async function validate() {
    if (!parsed) return;
    const response = await fetch('/api/import/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId: parsed.batchId, mapping }) });
    const body = await response.json();
    if (!response.ok) return setMessage(body.error ?? '검증에 실패했습니다.');
    setValidation(body);
    setConfirmed(false);
  }

  async function confirmImport() {
    if (!parsed || !validation?.canImport || !confirmed) return;
    const response = await fetch('/api/import/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId: parsed.batchId, confirmed: true }) });
    const body = await response.json();
    setMessage(response.ok ? `적재 완료: ${body.success_rows ?? body.successRows ?? 0}행` : body.error ?? '적재에 실패했습니다.');
  }

  return <div className="import-wizard">
    <div className="import-controls">
      <label>파일<input type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <label>데이터 종류<select value={importType} onChange={(event) => { setImportType(event.target.value as ImportType); setParsed(null); setValidation(null); }}>{getSupportedImportTypes().map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
      <label>적재 모드<select value={importMode} onChange={(event) => setImportMode(event.target.value as ImportMode)}><option value="append">append</option><option value="upsert">upsert</option><option value="replace">replace (ADMIN)</option></select></label>
      <Button type="button" variant="primary" onClick={parseFile} disabled={!file}>Parse</Button>
    </div>
    {parsed && <>
      <div className="import-summary"><strong>{parsed.totalRows.toLocaleString()}행</strong><span>{parsed.batchId}</span><Badge status="info">PREVIEW</Badge></div>
      <div className="import-mapping"><h3>Column Mapping</h3>{mapping.map((entry, index) => <label key={entry.sourceColumn}>{entry.sourceColumn}<select value={entry.targetColumn ?? ''} onChange={(event) => setMapping((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, targetColumn: event.target.value || null, confirmed: true } : item))}><option value="">매핑 안 함</option>{schema.fields.filter((field) => !['batch_id', 'source_type', 'loaded_at', 'source_record_id'].includes(field.name)).map((field) => <option key={field.name} value={field.name}>{field.name}</option>)}</select></label>)}</div>
      <Button type="button" onClick={validate}>Validation 실행</Button>
      <DataTable columns={parsed.headers.map((key) => ({ key, label: key }))} rows={parsed.preview} rowKey={(_, index) => String(index)} />
    </>}
    {validation && <div className="import-validation">
      <div className="import-result"><Badge status={validation.errorRows > 0 ? 'critical' : validation.warningRows > 0 ? 'warning' : 'safe'}>{validation.errorRows > 0 ? 'ERROR' : validation.warningRows > 0 ? 'WARNING' : 'SUCCESS'}</Badge><span>성공 {validation.successRows} / 경고 {validation.warningRows} / 오류 {validation.errorRows}</span></div>
      <DataTable columns={[{ key: 'rowNumber', label: '행' }, { key: 'errorCode', label: '코드' }, { key: 'errorMessage', label: '메시지' }, { key: 'severity', label: '심각도' }]} rows={validation.issues} rowKey={(row) => `${row.rowNumber}-${row.errorCode}`} />
      {validation.warningRows > 0 && validation.errorRows === 0 && <label className="import-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> WARNING을 확인했습니다.</label>}
      {validation.errorRows === 0 && validation.warningRows === 0 && <label className="import-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> 검증 결과를 확인했습니다.</label>}
      <Button type="button" variant="primary" onClick={confirmImport} disabled={!validation.canImport || !confirmed}>Import 승인 및 적재</Button>
    </div>}
    {message && <p className="admin-notice">{message}</p>}
  </div>;
}
