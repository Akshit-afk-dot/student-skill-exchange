import { useState } from 'react';
import { EmptyState, ErrorAlert, Pagination, TableSkeleton, formatDateTime } from '../components/ui';
import { useQuery } from '../hooks/useApi';
import type { Paginated } from '../lib/api';
import type { AuditEntry } from '../lib/types';

/** Human-readable labels for the action codes the server records. */
const ACTION_LABEL: Record<string, string> = {
  'user.active': 'Reinstated account',
  'user.suspended': 'Suspended account',
  'user.banned': 'Banned account',
  'report.resolve': 'Resolved report',
  'review.hide': 'Hid review',
  'review.unhide': 'Restored review',
  'skill.create': 'Created skill',
  'skill.approve': 'Approved skill',
  'skill.merge': 'Merged skills',
};

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useQuery<Paginated<AuditEntry>>(
    `/admin/audit-log?page=${page}&limit=50`,
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p>Every moderation action, newest first.</p>
        </div>
      </div>

      <ErrorAlert message={error} />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No actions recorded yet" hint="Moderation activity will appear here." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Administrator</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((entry) => (
                    <tr key={entry._id}>
                      <td className="nowrap">{formatDateTime(entry.createdAt)}</td>
                      <td>
                        {entry.actor?.name ?? 'Unknown'}
                        <div className="cell-sub">{entry.actor?.email}</div>
                      </td>
                      <td>{ACTION_LABEL[entry.action] ?? entry.action}</td>
                      <td>
                        {entry.targetType}
                        {entry.targetId ? (
                          <div className="cell-sub mono">{entry.targetId.slice(-8)}</div>
                        ) : null}
                      </td>
                      <td className="mono">
                        {Object.keys(entry.meta ?? {}).length > 0
                          ? JSON.stringify(entry.meta)
                          : '—'}
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
    </>
  );
}
