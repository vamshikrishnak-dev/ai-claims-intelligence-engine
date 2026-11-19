import type { PropsWithChildren } from 'react';
import type { ClaimStatus, Verdict } from '../types/claims';

const shortDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const preciseDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function DateLabel({ value, withTime = false }: { value: string; withTime?: boolean }) {
  return <time dateTime={value}>{(withTime ? preciseDate : shortDate).format(new Date(value))}</time>;
}

const statusLabels: Record<ClaimStatus, string> = {
  PROPOSED: 'Proposed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function StatusBadge({ status }: { status: ClaimStatus | Verdict }) {
  return <span className={`badge ${status.toLowerCase()}`}>
    {status in statusLabels ? statusLabels[status as ClaimStatus] : status.replaceAll('_', ' ')}
  </span>;
}

export function Notice({ children, kind = 'loading' }: PropsWithChildren<{ kind?: 'error' | 'success' | 'loading' }>) {
  return <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function LoadingError({ message, retry }: { message: string; retry: () => void }) {
  return <Notice kind="error">
    <span>{message}</span>
    <button type="button" className="quiet" onClick={retry}>Try again</button>
  </Notice>;
}

export function Brand() {
  return <a href="#claims" className="brand" aria-label="AI Claims Intelligence Engine">
    <span className="brand-mark" aria-hidden="true">AI</span>
    <span><strong>AI Claims</strong><small>Intelligence Engine</small></span>
  </a>;
}
