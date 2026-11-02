import type { CSSProperties, ReactNode } from 'react';

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <Spinner />
      <div style={{ marginTop: 10 }}>{label}</div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {hint ? <p className="mt-0">{hint}</p> : null}
    </div>
  );
}

export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      {message}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** `alert` marks a number that someone needs to act on. */
  tone?: 'neutral' | 'alert';
}) {
  return (
    <div className={tone === 'alert' ? 'stat stat-alert' : 'stat'}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  BANNED: 'danger',
  OPEN: 'warning',
  REVIEWING: 'info',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status.toLowerCase()}</Badge>;
}

/** Initials fallback so a missing profile photo still reads as a person. */
export function Avatar({ name, src }: { name: string; src?: string }) {
  if (src) return <img className="avatar" src={src} alt="" />;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="avatar" aria-hidden="true">
      {initials || '?'}
    </span>
  );
}

export function Modal({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose(): void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // Clicking the backdrop dismisses; clicks inside the panel must not bubble to it.
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage(page: number): void;
}) {
  if (total === 0) return null;
  return (
    <div className="pagination">
      <span>
        Page {page} of {Math.max(1, totalPages)} · {total} total
      </span>
      <div className="row">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          className="btn btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Relative time for recent events, absolute date once it stops being useful. */
export function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

/** "1 review" / "2 reviews" — plural forms that do not read like a database dump. */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
}

/**
 * Shimmer placeholders that match the shape of the content they stand in for. A spinner
 * tells the user something is happening; a skeleton tells them what is coming.
 */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-stats" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="stat" key={i}>
          <Skeleton className="skeleton-line-sm" />
          <Skeleton className="skeleton-line-lg" />
          <Skeleton className="skeleton-line-xs" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns }: { rows?: number; columns: number }) {
  return (
    <div className="table-skeleton" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div className="table-skeleton-row" key={r}>
          {Array.from({ length: columns }, (_, c) => (
            // Varied widths so the placeholder reads as ragged text, not a grid.
            <Skeleton
              key={c}
              className="skeleton-cell"
              style={{ width: `${55 + ((r * 7 + c * 13) % 40)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
