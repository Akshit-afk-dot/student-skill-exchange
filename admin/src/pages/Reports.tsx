import { useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorAlert,
  Loading,
  Modal,
  Pagination,
  StatusBadge,
  timeAgo,
} from '../components/ui';
import { useMutation, useQuery } from '../hooks/useApi';
import { api, type Paginated } from '../lib/api';
import type { AdminReport, ModerationAction } from '../lib/types';

const REASON_LABEL: Record<string, string> = {
  SPAM: 'Spam',
  HARASSMENT: 'Harassment',
  FAKE_PROFILE: 'Fake profile',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  SUSPICIOUS_BEHAVIOUR: 'Suspicious behaviour',
  OTHER: 'Other',
};

const ACTIONS: Array<{ value: ModerationAction; label: string; hint: string }> = [
  { value: 'NONE', label: 'No action', hint: 'Nothing happens to the reported account.' },
  { value: 'WARNING', label: 'Send a warning', hint: 'Notifies the student without restricting them.' },
  {
    value: 'CONTENT_REMOVED',
    label: 'Remove the content',
    hint: 'Hides the reported message or review.',
  },
  { value: 'SUSPENDED', label: 'Suspend the account', hint: 'Blocks access for a set period.' },
  { value: 'BANNED', label: 'Ban the account', hint: 'Permanently blocks access.' },
];

export function ReportsPage() {
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminReport | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (status) params.set('status', status);
    return `/admin/reports?${params.toString()}`;
  }, [page, status]);

  const { data, error, loading, reload } = useQuery<Paginated<AdminReport>>(path);

  const claim = useMutation(async (id: string) => api.post(`/admin/reports/${id}/claim`));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Safety queue, oldest first.</p>
        </div>
      </div>

      <div className="toolbar">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="OPEN">Open</option>
          <option value="REVIEWING">Reviewing</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
          <option value="">All</option>
        </select>
      </div>

      <ErrorAlert message={error ?? claim.error} />

      <div className="card">
        {loading ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="Nothing in the queue"
            hint={
              status === 'OPEN'
                ? 'No open reports. The community is behaving itself.'
                : 'No reports with this status.'
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reported student</th>
                    <th>Reason</th>
                    <th>Reported by</th>
                    <th>Status</th>
                    <th>Filed</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((report) => (
                    <tr key={report._id}>
                      <td>
                        <div className="cell-user">
                          <Avatar
                            name={report.reportedUser?.name ?? '?'}
                            src={report.reportedUser?.profileImage}
                          />
                          <div>
                            <div>{report.reportedUser?.name ?? 'Deleted account'}</div>
                            <div className="cell-sub">
                              {report.reportedUser ? (
                                <StatusBadge status={report.reportedUser.status} />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone="warning">{REASON_LABEL[report.reason] ?? report.reason}</Badge>
                        {report.description ? (
                          <div className="cell-sub" title={report.description}>
                            {report.description.slice(0, 60)}
                            {report.description.length > 60 ? '…' : ''}
                          </div>
                        ) : null}
                      </td>
                      <td>{report.reporter?.name ?? '—'}</td>
                      <td>
                        <StatusBadge status={report.status} />
                        {report.actionTaken && report.actionTaken !== 'NONE' ? (
                          <div className="cell-sub">{report.actionTaken.toLowerCase()}</div>
                        ) : null}
                      </td>
                      <td className="nowrap">{timeAgo(report.createdAt)}</td>
                      <td className="text-right">
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          {report.status === 'OPEN' ? (
                            <button
                              className="btn btn-sm"
                              disabled={claim.pending}
                              onClick={async () => {
                                if ((await claim.run(report._id)) !== null) reload();
                              }}
                            >
                              Claim
                            </button>
                          ) : null}
                          {report.status === 'OPEN' || report.status === 'REVIEWING' ? (
                            <button className="btn btn-sm btn-primary" onClick={() => setTarget(report)}>
                              Resolve
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              onPage={setPage}
            />
          </>
        )}
      </div>

      {target ? (
        <ResolveModal
          report={target}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function ResolveModal({
  report,
  onClose,
  onDone,
}: {
  report: AdminReport;
  onClose(): void;
  onDone(): void;
}) {
  const [action, setAction] = useState<ModerationAction>('WARNING');
  const [days, setDays] = useState(7);
  const [note, setNote] = useState('');
  const [dismiss, setDismiss] = useState(false);

  const resolve = useMutation(async () =>
    api.post(`/admin/reports/${report._id}/resolve`, {
      action,
      dismiss,
      ...(action === 'SUSPENDED' ? { suspendDays: days } : {}),
      ...(note.trim() ? { resolutionNote: note.trim() } : {}),
    }),
  );

  const selected = ACTIONS.find((a) => a.value === action);

  return (
    <Modal
      title="Resolve report"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={resolve.pending}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={resolve.pending}
            onClick={async () => {
              if ((await resolve.run()) !== null) onDone();
            }}
          >
            {resolve.pending ? 'Saving…' : 'Close report'}
          </button>
        </>
      }
    >
      <ErrorAlert message={resolve.error} />

      <div className="card mb-16">
        <div className="card-body">
          <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>
            {REASON_LABEL[report.reason] ?? report.reason} · reported by{' '}
            {report.reporter?.name ?? 'unknown'}
          </div>
          <p style={{ marginBottom: 0 }}>
            {report.description || <span className="muted">No description provided.</span>}
          </p>
          {report.relatedMessage ? (
            <blockquote
              className="mono"
              style={{
                margin: '12px 0 0',
                padding: '8px 12px',
                borderLeft: '3px solid var(--border)',
              }}
            >
              {report.relatedMessage.body || '(message content was removed)'}
            </blockquote>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="res-action">Action</label>
        <select
          id="res-action"
          value={action}
          onChange={(e) => setAction(e.target.value as ModerationAction)}
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {selected ? (
          <div className="cell-sub" style={{ marginTop: 4 }}>
            {selected.hint}
          </div>
        ) : null}
      </div>

      {action === 'SUSPENDED' ? (
        <div className="field">
          <label htmlFor="res-days">Suspension length (days)</label>
          <input
            id="res-days"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="res-note">Resolution note</label>
        <textarea
          id="res-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you find, and what did you do about it?"
        />
      </div>

      <label className="row" style={{ fontWeight: 400 }}>
        <input
          type="checkbox"
          checked={dismiss}
          onChange={(e) => setDismiss(e.target.checked)}
          style={{ width: 'auto' }}
        />
        <span>Mark as dismissed rather than resolved (the report was unfounded)</span>
      </label>
    </Modal>
  );
}
