/** 空态 / 错误态：同一张自制插图，错误态只把描边换成 danger 色。 */
export function EmptyState({
  kind = 'empty',
  title,
  text,
  actionLabel,
  onAction,
  testid = 'empty-state',
}: {
  kind?: 'empty' | 'error';
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  testid?: string;
}) {
  const stroke1 = kind === 'error' ? 'var(--rill-danger)' : 'var(--rill-surface-3)';
  const stroke2 = kind === 'error' ? 'var(--rill-danger)' : 'var(--rill-accent-soft)';
  return (
    <div className="state" data-testid={testid} role={kind === 'error' ? 'alert' : undefined}>
      <svg className="state__art" viewBox="0 0 160 120" width="160" height="120" role="img" aria-label={title}>
        <rect x="0.5" y="0.5" width="159" height="119" rx="16" fill="var(--rill-surface-2)" />
        <path d="M24 78c14-22 30-22 44 0s30 22 44 0 24-14 24-14" fill="none" stroke={stroke1} strokeWidth="6" strokeLinecap="round" />
        <path d="M24 90c14-22 30-22 44 0s30 22 44 0 24-14 24-14" fill="none" stroke={stroke2} strokeWidth="6" strokeLinecap="round" />
        <circle cx="70" cy="36" r="9" fill="var(--rill-accent-soft)" stroke="var(--rill-surface-3)" strokeWidth="3" />
        <circle cx="96" cy="48" r="5" fill="var(--rill-surface-3)" />
      </svg>
      <p className="state__title">{title}</p>
      {text ? <p className="state__text">{text}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="btn btn--ghost state__action" onClick={onAction} data-testid="state-action">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}