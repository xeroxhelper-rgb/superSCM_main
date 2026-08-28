import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportType, ParsedImport, SourceRow } from './types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 50_000;

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function ensureRows(fileName: string, headers: string[], rows: SourceRow[]): ParsedImport {
  if (headers.length === 0 || rows.length === 0) throw new Error('파일이 비어 있습니다.');
  if (rows.length > MAX_ROWS) throw new Error(`최대 ${MAX_ROWS.toLocaleString()}행까지 업로드할 수 있습니다.`);
  return { fileName, headers, rows, totalRows: rows.length };
}

async function parseCsv(file: File): Promise<ParsedImport> {
  const text = await file.text();
  if (!text.trim()) throw new Error('파일이 비어 있습니다.');
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (parsed.errors.length > 0) throw new Error(`CSV 파싱 오류: ${parsed.errors[0].message}`);
  const rows = parsed.data.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeCell(value)])));
  return ensureRows(file.name, parsed.meta.fields ?? [], rows);
}

async function parseXlsx(file: File): Promise<ParsedImport> {
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', raw: false, cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('Excel 시트가 비어 있습니다.');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '', raw: false });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return ensureRows(file.name, headers, rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeCell(value)]))));
}

export async function parseImportFile(file: File, _importType: ImportType): Promise<ParsedImport> {
  if (file.size > MAX_FILE_BYTES) throw new Error('파일 크기가 10MB를 초과합니다.');
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'csv') return parseCsv(file);
  if (extension === 'xlsx') return parseXlsx(file);
  throw new Error('지원하지 않는 파일 형식입니다. CSV 또는 XLSX만 업로드할 수 있습니다.');
}
