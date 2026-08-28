import type { ReactNode } from 'react';

export type UiColumn<T> = { key: string; label: string; align?: 'left' | 'right' | 'center'; render?: (row: T) => ReactNode };

export default function DataTable<T>({ columns, rows, rowKey, empty = '표시할 데이터가 없습니다.', error }: { columns: UiColumn<T>[]; rows: T[]; rowKey?: (row: T, index: number) => string; empty?: ReactNode; error?: string | null }) {
  if (error) return <p className="empty-state-ui"><strong>조회에 실패했습니다.</strong><br />{error}</p>;
  if (rows.length === 0) return <p className="empty-state-ui">{empty}</p>;
  return <div className="data-table-wrap"><table className="data-table-ui"><thead><tr>{columns.map((column) => <th key={column.key} style={column.align ? { textAlign: column.align } : undefined}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={rowKey ? rowKey(row, index) : String(index)}>{columns.map((column) => <td key={column.key} style={column.align ? { textAlign: column.align } : undefined}>{column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '—')}</td>)}</tr>)}</tbody></table></div>;
}
