export default function EmptyValue({ reason, label = '계산 불가' }: { reason?: string | null; label?: string }) {
  return <span className="empty-value" aria-label={`${label}${reason ? `: ${reason}` : ''}`}><span>—</span>{reason && <span className="empty-value-reason">{reason}</span>}</span>;
}
