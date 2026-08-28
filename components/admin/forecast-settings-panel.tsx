import Badge from '@/components/ui/badge';
import EmptyValue from '@/components/ui/empty-value';
import Panel from '@/components/ui/panel';

type SettingsRow = {
  actual_start: string | null; actual_end: string | null;
  train_start: string | null; train_end: string | null;
  test_start: string | null; test_end: string | null;
  granularity: string; train_row_count: number; test_row_count: number;
  train_window_ok: boolean; test_window_ok: boolean; windows_do_not_overlap: boolean;
  policy_values: Array<Record<string, unknown>>; item_policy_count: number; enabled_outlier_rule_count: number;
};
function DateValue({ value }: { value: string | null }) { return value ? <time dateTime={value}>{value}</time> : <EmptyValue reason="NOT_CONFIGURED" />; }
function CheckBadge({ value }: { value: boolean }) { return value ? <Badge status="safe">SAFE</Badge> : <Badge status="warning">CHECK REQUIRED</Badge>; }

export default function ForecastSettingsPanel({ row }: { row: SettingsRow }) {
  return <div className="forecast-settings-grid">
    <Panel title="데이터 전체 기간" meta="ACTUAL"><dl className="settings-list"><dt>시작일</dt><dd><DateValue value={row.actual_start} /></dd><dt>종료일</dt><dd><DateValue value={row.actual_end} /></dd></dl></Panel>
    <Panel title="학습 기간" meta="TRAIN"><dl className="settings-list"><dt>시작일</dt><dd><DateValue value={row.train_start} /></dd><dt>종료일</dt><dd><DateValue value={row.train_end} /></dd><dt>행 수</dt><dd>{row.train_row_count}</dd><dt>범위 상태</dt><dd><CheckBadge value={row.train_window_ok} /></dd></dl></Panel>
    <Panel title="검증 기간" meta="TEST"><dl className="settings-list"><dt>시작일</dt><dd><DateValue value={row.test_start} /></dd><dt>종료일</dt><dd><DateValue value={row.test_end} /></dd><dt>행 수</dt><dd>{row.test_row_count}</dd><dt>범위 상태</dt><dd><CheckBadge value={row.test_window_ok} /></dd></dl></Panel>
    <Panel title="격리 및 정책" meta="CONTROL"><dl className="settings-list"><dt>Granularity</dt><dd>{row.granularity}</dd><dt>기간 중복</dt><dd><CheckBadge value={row.windows_do_not_overlap} /></dd><dt>품목 정책 수</dt><dd>{row.item_policy_count}</dd><dt>활성 예외 규칙</dt><dd>{row.enabled_outlier_rule_count}</dd></dl><div className="policy-values"><strong>공통 정책</strong>{row.policy_values.length ? row.policy_values.map((policy) => <div key={String(policy.policy_key)}>{String(policy.policy_key)}: {String(policy.config_value_text ?? policy.config_value_numeric ?? '—')}</div>) : <EmptyValue reason="NO_POLICY" />}</div></Panel>
  </div>;
}
