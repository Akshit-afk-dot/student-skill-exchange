import { useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorAlert,
  TableSkeleton,
  Modal,
  Pagination,
  StatusBadge,
  formatDate,
  plural,
} from '../components/ui';
import { useMutation, useQuery } from '../hooks/useApi';
import { api, type Paginated } from '../lib/api';
import type { AdminUser } from '../lib/types';

type StatusFilter = '' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUser | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25', sort });
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    return `/admin/users?${params.toString()}`;
  }, [page, query, status, sort]);

  const { data, error, loading, reload } = useQuery<Paginated<AdminUser>>(path);

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Students</h1>
          <p>Search accounts and manage standing.</p>
        </div>
      </div>

      <form className="toolbar" onSubmit={applySearch}>
        <input
          type="search"
          placeholder="Search name, email or college"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search students"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as StatusFilter);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
        <select
          value={sort}
          onChange={(e) => {
            setPage(1);
            setSort(e.target.value);
          }}
          aria-label="Sort by"
        >
          <option value="recent">Newest first</option>
          <option value="name">Name</option>
          <option value="points">Points</option>
          <option value="rating">Rating</option>
        </select>
        <button className="btn">Search</button>
      </form>

      <ErrorAlert message={error} />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={8} columns={6} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title="No students found"
            hint="Try a different search term or clear the filters."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>College</th>
                    <th>Status</th>
                    <th>Rating</th>
                    <th className="hide-md">Sessions</th>
                    <th className="hide-md">Points</th>
                    <th className="hide-md">Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={user.name} src={user.profileImage} />
                          <div>
                            <div>
                              {user.name}{' '}
                              {user.role === 'ADMIN' ? <Badge tone="accent">admin</Badge> : null}
                            </div>
                            <div className="cell-sub">
                              {user.email}
                              {!user.emailVerified ? ' · unverified' : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="truncate" title={user.college ?? undefined}>{user.college ?? '—'}</span>
                        {user.department ? <div className="cell-sub">{user.department}</div> : null}
                      </td>
                      <td>
                        <StatusBadge status={user.status} />
                      </td>
                      <td className="nowrap">
                        {user.ratingCount > 0 ? `${user.ratingAvg.toFixed(1)} ★` : '—'}
                        <div className="cell-sub">{plural(user.ratingCount, 'review')}</div>
                      </td>
                      <td className="nowrap hide-md">
                        {user.stats.sessionsTaught + user.stats.sessionsLearned}
                        <div className="cell-sub">{user.stats.sessionsTaught} taught</div>
                      </td>
                      <td className="hide-md">{user.stats.points}</td>
                      <td className="nowrap hide-md">{formatDate(user.createdAt)}</td>
                      <td className="text-right">
                        <button
                          className="btn btn-sm"
                          onClick={() => setTarget(user)}
                          disabled={user.role === 'ADMIN'}
                          title={
                            user.role === 'ADMIN'
                              ? 'Administrator accounts cannot be moderated here'
                              : 'Change account standing'
                          }
                        >
                          Moderate
                        </button>
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
        <ModerateModal
          user={target}
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

function ModerateModal({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose(): void;
  onDone(): void;
}) {
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'BANNED'>(
    user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
  );
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');

  const moderate = useMutation(async () =>
    api.post(`/admin/users/${user._id}/moderate`, {
      status,
      // Only meaningful for a suspension; the API ignores it otherwise.
      ...(status === 'SUSPENDED' ? { suspendDays: Math.min(365, Math.max(1, Number(days) || 1)) } : {}),
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    }),
  );

  async function submit() {
    const result = await moderate.run();
    if (result !== null) onDone();
  }

  return (
    <Modal
      title={`Moderate ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={moderate.pending}>
            Cancel
          </button>
          <button
            className={status === 'ACTIVE' ? 'btn btn-primary' : 'btn btn-danger'}
            onClick={submit}
            disabled={moderate.pending}
          >
            {moderate.pending ? 'Applying…' : status === 'ACTIVE' ? 'Reinstate' : 'Apply'}
          </button>
        </>
      }
    >
      <ErrorAlert message={moderate.error} />

      <p className="muted mt-0">
        Currently <StatusBadge status={user.status} />
        {user.suspendedUntil ? ` until ${formatDate(user.suspendedUntil)}` : ''}.
      </p>

      <div className="field">
        <label htmlFor="mod-status">New standing</label>
        <select
          id="mod-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="ACTIVE">Active — full access</option>
          <option value="SUSPENDED">Suspended — temporarily blocked</option>
          <option value="BANNED">Banned — permanently blocked</option>
        </select>
      </div>

      {status === 'SUSPENDED' ? (
        <div className="field">
          <label htmlFor="mod-days">Suspension length (days)</label>
          <input
            id="mod-days"
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="mod-reason">Reason (sent to the student)</label>
        <textarea
          id="mod-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Repeated spam messages to other students"
        />
      </div>

      {status !== 'ACTIVE' ? (
        <p className="muted" style={{ fontSize: 12 }}>
          This signs the student out of every device immediately.
        </p>
      ) : null}
    </Modal>
  );
}
